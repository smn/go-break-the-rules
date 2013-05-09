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
    StateCreator.call(self, 'ask_name');

    self.add_state(new FreeText(
        'ask_name',
        'ask_surname',
        'Hey! What\'s your first name?'));

    self.add_state(new FreeText(
        'ask_surname',
        'end',
        'Thanks! What is your surname?'));

    self.add_state(new EndState(
        'end',
        'Thanks!',
        'ask_name',
        {
            on_enter: function() {
                var p = new Promise();
                api.request('contacts.get_or_create', {
                    delivery_class: 'sms',
                    addr: im.user_addr
                }, p.callback);

                p.add_callback(function(result) {
                    return result.contact;
                });
                p.add_callback(function(contact) {
                    var update_contact = new Promise();
                    api.request('contacts.update', {
                        key: contact.key,
                        fields: {
                            name: im.get_user_answer('ask_name'),
                            surname: im.get_user_answer('ask_surname')
                        }
                    }, update_contact.callback);
                    return update_contact;
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