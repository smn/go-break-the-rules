var vumigo = require("vumigo_v01");
var jed = require("jed");

if (typeof api === "undefined") {
    // testing hook (supplies api when it is not passed in by the real sandbox)
    var api = this.api = new vumigo.dummy_api.DummyApi();
    api._dummy_contacts = {};
    api._handle_contacts_get_or_create = function(cmd, reply) {
        reply({
            success: true,
            created: false,
            contact: {
                key: 'contact-key'
            }
        });
    };

    api._handle_contacts_update = function(cmd, reply) {
        api._dummy_contacts[cmd.key] = cmd.fields;
        api._dummy_contacts[cmd.key]['extras'] = {};
        reply({success: true});
    };

    api._handle_contacts_update_extra = function(cmd, reply) {
        api._dummy_contacts[cmd.contact_key]['extras'][cmd.field] = cmd.value;
        reply({success: true});
    };
}

var Promise = vumigo.promise.Promise;
var success = vumigo.promise.success;
var Choice = vumigo.states.Choice;
var ChoiceState = vumigo.states.ChoiceState;
var FreeText = vumigo.states.FreeText;
var EndState = vumigo.states.EndState;
var InteractionMachine = vumigo.state_machine.InteractionMachine;
var StateCreator = vumigo.state_machine.StateCreator;

function BreakTheRules() {
    var self = this;
    StateCreator.call(self, 'name');

    self.add_state(new FreeText(
        'name',
        'programming_language',
        ('Hey! We\'re the Praekelt Foundation. We develop Open Source ' +
            'software to improve lives of people living in poverty.\n' +
            'What\'s your name?')
    ));

    self.add_state(new ChoiceState(
        'programming_language',
        'framework',
        'Thanks! We\'re looking for an intern. Which programming ' +
        'language do you prefer?',
        [
            new Choice('java', 'Java'),
            new Choice('python', 'Python'),
            new Choice('c', 'C'),
            new Choice('php', 'PHP'),
            new Choice('c#', 'C#')
        ]
    ));

    self.add_state(new ChoiceState(
        'framework',
        'ask_github',
        'Which of the following do you have experience with?',
        [
            new Choice('django', 'Django'),
            new Choice('twisted', 'Twisted'),
            new Choice('node', 'Node.js'),
            new Choice('none', 'None of the above')
        ]
    ));

    self.add_state(new ChoiceState(
        'ask_github',
        function(choice) {
            return choice.value == 'yes' ? 'github' : 'end';
        },
        'Do you have a GitHub account?',
        [
            new Choice('yes', 'Yes and I\'m happy to tell you.'),
            new Choice('no', 'No.')
        ]
    ));

    self.add_state(new FreeText(
        'github',
        'end',
        'Sweet! What\'s your GitHub account?'
    ));

    self.add_state(new EndState(
        'end',
        'Thanks!',
        'name',
        {
            on_enter: function(state) {
                var im = this.im;
                var contact = null;

                var update_extra = function (field) {
                    return im.api_request('contacts.update_extra', {
                        'contact_key': contact.key,
                        'field': field,
                        'value': im.get_user_answer(field)
                    });
                };

                var p = im.api_request('contacts.get_or_create', {
                    delivery_class: 'sms',
                    addr: im.user_addr
                });
                p.add_callback(function(result) {
                    contact = result.contact;
                    return im.api_request('contacts.update', {
                        key: contact.key,
                        fields: {
                            name: im.get_user_answer('name')
                        }
                    });
                });
                p.add_callback(function() {
                    return update_extra('programming_language');
                });
                p.add_callback(function() {
                    return update_extra('framework');
                });
                p.add_callback(function() {
                    return update_extra('github');
                });

                return p;
            }
        }
    ));
}

// launch app
var states = new BreakTheRules();
var im = new InteractionMachine(api, states);
im.attach();