var fs = require("fs");
var assert = require("assert");
var vumigo = require("vumigo_v01");
var app = require("../lib/break-the-rules");

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

    tester = new vumigo.test_utils.ImTester(app.api);

    it('should intro the Praekelt Foundation & ask for my name', function() {
        tester.check_state({
            user: null,
            content: null,
            next_state: 'ask_name',
            response: (
                '^Hey! We\'re the Praekelt Foundation. ' +
                'we develop Open Source software to improve lives of ' +
                'people living in poverty. ' +
                'What\'s your first name?'
            )
        });
    });

    it('should ask for my surname', function() {
        var user = {
            current_state: 'ask_name'
        };
        tester.check_state({
            user: user,
            content: 'Simon',
            next_state: 'programming_language',
            response: (
                '^Thanks! We\'re looking for an intern. ' +
                'Which programming language do you prefer? [^]' +
                '1. Java[^]' +
                '2. Python[^]' +
                '3. C/C++[^]' +
                '4. PHP[^]' +
                '5. C#$'
            )
        });
    });

    it('should ask for framework background', function() {
        var user = {
            current_state: 'programming_language',
            answers: {
                name: 'Simon'
            }
        };
        tester.check_state({
            user: user,
            content: '2',
            next_state: 'framework',
            response: (
                '^Do you have experience with any of the following?[^]' +
                '1. Twisted[^]' +
                '2. Django[^]' +
                '3. Node.js$'
            )
        });
    });

    it('should ask for tool familiarity', function() {
        var user = {
            current_state: 'framework',
            answers: {
                name: 'Simon',
                programming_language: 'python'
            }
        };
        tester.check_state({
            user: user,
            content: '1',
            next_state: 'ask_github',
            reponse: (
                '^Do you have a GitHub account?[^]' +
                '1. Yes and I\'m happy to tell you[^]' +
                '2. No.$'
            )
        });
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
        tester.check_state({
            user: user,
            content: '1',
            next_state: 'github',
            response: '^Sweet! What\'s your GitHub account?$'
        });
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
        tester.check_state({
            user: user,
            content: '2',
            next_state: 'end',
            response: '^Thanks!'
        });
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
        tester.check_state({
            user: user,
            content: 'smn',
            next_state: 'end',
            response: '^Thanks!'
        });
        var contact = app.api._dummy_contacts['contact-key'];
        assert.equal(contact.name, 'Simon');
        assert.equal(contact.programming_language, 'python');
        assert.equal(contact.framework, 'twisted');
        assert.equal(contact.github, 'smn');
    });
});