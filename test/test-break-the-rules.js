var fs = require("fs");
var assert = require("assert");
var app = require("../lib/break-the-rules");


function fresh_api() {
    var api = app.api;
    api.reset();
    reset_im(api.im);
    return api;
}

function reset_im(im) {
    im.user = null;
    im.i18n = null;
    im.i18n_lang = null;
    im.current_state = null;
}

function maybe_call(f, that, args) {
    if (typeof f != "undefined" && f !== null) {
        f.apply(that, args);
    }
}

function check_state(user, content, next_state, expected_response, setup,
                     teardown) {
    // setup api
    var api = fresh_api();
    var from_addr = "1234567";
    var user_key = "users." + from_addr;
    api.kv_store[user_key] = user;

    maybe_call(setup, this, [api]);

    api.add_reply({
        cmd: "outbound.reply_to"
    });

    // send message
    api.on_inbound_message({
        cmd: "inbound-message",
        msg: {
            from_addr: from_addr,
            content: content,
            message_id: "123"
        }
    });

    // check result
    var saved_user = api.kv_store[user_key];
    assert.equal(saved_user.current_state, next_state);
    var reply = api.request_calls.shift();
    var response = reply.content;
    try {
        assert.ok(response);
        assert.ok(response.match(expected_response));
        assert.ok(response.length <= 163);
    } catch (e) {
        console.log(api.logs);
        console.log(response);
        console.log(expected_response);
        if (typeof response != 'undefined')
            console.log("Content length: " + response.length);
        throw e;
    }
    assert.deepEqual(app.api.request_calls, []);
    assert.equal(app.api.done_calls, 1);

    maybe_call(teardown, this, [api, saved_user]);
}

function check_close(user, next_state, setup, teardown) {
    var api = fresh_api();
    var from_addr = "1234567";
    var user_key = "users." + from_addr;
    api.kv_store[user_key] = user;

    maybe_call(setup, this, [api]);

    // send message
    api.on_inbound_message({
        cmd: "inbound-message",
        msg: {
            from_addr: from_addr,
            session_event: "close",
            content: "User Timeout",
            message_id: "123"
        }
    });

    // check result
    var saved_user = api.kv_store[user_key];
    assert.equal(saved_user.current_state, next_state);
    assert.deepEqual(app.api.request_calls, []);
    assert.equal(app.api.done_calls, 1);

    maybe_call(teardown, this, [api, saved_user]);
}


function CustomTester(custom_setup, custom_teardown) {
    var self = this;

    self._combine_setup = function(custom_setup, orig_setup) {
        var combined_setup = function (api) {
            maybe_call(custom_setup, self, [api]);
            maybe_call(orig_setup, this, [api]);
        };
        return combined_setup;
    };

    self._combine_teardown = function(custom_teardown, orig_teardown) {
        var combined_teardown = function (api, saved_user) {
            maybe_call(custom_teardown, self, [api, saved_user]);
            maybe_call(orig_teardown, this, [api, saved_user]);
        };
        return combined_teardown;
    };

    self.check_state = function(user, content, next_state, expected_response,
                                setup, teardown) {
        return check_state(user, content, next_state, expected_response,
                           self._combine_setup(custom_setup, setup),
                           self._combine_teardown(custom_teardown, teardown));
    };

    self.check_close = function(user, next_state, setup, teardown) {
        return check_close(user, next_state,
                           self._combine_setup(custom_setup, setup),
                           self._combine_teardown(custom_teardown, teardown));
    };
}

describe("test_api", function() {
    it("should exist", function() {
        assert.ok(app.api);
    });
    it("should have an on_inbound_message method", function() {
        assert.ok(app.api.on_inbound_message);
    });
    it("should have an on_inbound_event method", function() {
        assert.ok(app.api.on_inbound_event);
    });
});

describe('break the rules app', function() {

    tester = new CustomTester();

    it('should intro the Praekelt Foundation & ask for my name', function() {
        tester.check_state(null, null, 'name',
            '^Hey! We\'re the Praekelt Foundation. ' +
            'We develop Open Source software to improve lives of ' +
            'people living in poverty.[^]' +
            'What\'s your name\\?');
    });

    it('should ask for my programming language preference', function() {
        var user = {
            current_state: 'name'
        };
        tester.check_state(user, 'Simon', 'programming_language',
            '^Thanks! We\'re looking for an intern. ' +
            'Which programming language do you prefer\\?[^]' +
            '1. Java[^]' +
            '2. Python[^]' +
            '3. C[^]' +
            '4. PHP[^]' +
            '5. C#$');
    });

    it('should ask for framework background', function() {
        var user = {
            current_state: 'programming_language',
            answers: {
                name: 'Simon'
            }
        };
        tester.check_state(user, '2', 'framework',
            '^Which of the following do you have experience with\\?[^]' +
            '1. Django[^]' +
            '2. Twisted[^]' +
            '3. Node.js[^]' +
            '4. None of the above$'
        );
    });

    it('should ask for tool familiarity', function() {
        var user = {
            current_state: 'framework',
            answers: {
                name: 'Simon',
                programming_language: 'python'
            }
        };
        tester.check_state(user, '1', 'ask_github',
            '^Do you have a GitHub account\\?[^]' +
            '1. Yes and I\'m happy to tell you.[^]' +
            '2. No.$');
    });

    it('should ask for my GitHub account', function() {
        var user = {
            current_state: 'ask_github',
            answers: {
                name: 'Simon',
                programming_language: 'python',
                framework: 'twisted'
            }
        };
        tester.check_state(user, '1', 'github',
            '^Sweet! What\'s your GitHub account\\?$');
    });

    it('should skip to the end if not wanting to provide GitHub acct', function() {
        var user = {
            current_state: 'ask_github',
            answers: {
                name: 'Simon',
                programming_language: 'python',
                framework: 'twisted'
            }
        };
        tester.check_state(user, '2', 'end',
            '^Thanks!');
    });

    it('should thank me and store the contact', function() {
        var user = {
            current_state: 'github',
            answers: {
                name: 'Simon',
                programming_language: 'python',
                framework: 'twisted'
            }
        };
        tester.check_state(user, 'smn', 'end',
            '^Thanks!');
        var contact = app.api._dummy_contacts['contact-key'];
        assert.equal(contact.name, 'Simon');
        assert.equal(contact.programming_language, 'python');
        assert.equal(contact.framework, 'twisted');
        assert.equal(contact.github, 'smn');
    });
});