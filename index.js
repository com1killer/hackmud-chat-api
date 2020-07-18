var fetch = require("node-fetch");
var deasync = require("deasync");

class HackmudChatAPI {
    //#region Properties
    /**
     * Chat token.
     */
    token;

    /**
     * FOR INTERNAL USE ONLY.
     * Base URL of the hackmud API
     * @private
     */
    url;

    /**
     * An object of users, where the user is the key, and an array of their channels is the value.
     * @example {"com": ["0000", "town"], "com1killer": []}
     */
    users;

    /**
     * The JS timestamp of the last poll.
     */
    lastPoll;
    
    /**
     * FOR INTERNAL USE ONLY.
     * setInterval ID of polling timer.
     * @readonly
     * @private
     */
    pollTimerID;

    /**
     * FOR INTERNAL USE ONLY.
     * setInterval ID of accountSync timer.
     * @readonly
     * @private
     */
    accountSyncTimerID;

    /**
     * FOR INTERNAL USE ONLY.
     * Store of event handler functions.
     * @private
     */
    eventHandlers = {
        poll: [],
        error: [],
        accountSync: []
    }
    //#endregion

    //#region Requests
    /**
     * FOR INTERNAL USE ONLY.
     * Sends a request to the Chat API.
     * @private
     * @param {string} path API endpoint path
     * @param {object} [body] Body of request
     */
    async _request(path, body) {
        var res = await fetch(this.url + path, {
            method: body ? "POST" : "GET",
            body: body ? JSON.stringify(body) : undefined,
            headers: { 'Content-Type': 'application/json' }
        });
        let resBody = await res.json();
        if (res.status < 200 || res.status >= 400) throw resBody;
        else return resBody;
    }

    /**
     * FOR INTERNAL USE ONLY.
     * Exchanges a chat pass for a chat token.
     * @private
     * @param {string} pass Hackmud chat pass.
     * @async
     */
    _get_token(pass) {
        return this._request("/get_token.json", {pass});
    }

    /**
     * FOR INTERNAL USE ONLY.
     * Gets account data.
     * @private
     * @async
     */
    _account_data() {
        return this._request("/account_data.json", {chat_token: this.token});
    }

    /**
     * FOR INTERNAL USE ONLY.
     * Gets chats.
     * before or after must be specified.
     * @private
     * @param {string[]} usernames Users to include in chat lookup
     * @param {number} [before] Gets chats before this JS timestamp
     * @param {number} [after] Gets chats after this JS timestamp
     * @async
     */
    _chats(usernames, before, after) {
        return this._request("/chats.json", {chat_token: this.token, usernames, before: before != undefined ? Math.floor(before/1000) : undefined, after: after != undefined ? Math.floor(after/1000) : undefined});
    }

    /**
     * FOR INTERNAL USE ONLY.
     * Sends a chat to a channel.
     * @private
     * @param {string} username User to send message from
     * @param {string} channel Channel to send message to
     * @param {string} msg Message to send
     * @async
     */
    _send(username, channel, msg) {
        return this._request("/create_chat.json", {chat_token: this.token, username, channel, msg});
    }

    /**
     * FOR INTERNAL USE ONLY.
     * Sends a chat to a channel.
     * @private
     * @param {string} username User to send message from
     * @param {string} tell User to send message to
     * @param {string} msg Message to send
     * @async
     */
    _tell(username, tell, msg) {
        return this._request("/create_chat.json", {chat_token: this.token, username, tell, msg});
    }

    /**
     * FOR INTERNAL USE ONLY.
     * Get chat history.
     * @private
     * @param {string} username User to view the history from
     * @param {string} channel Channel to view the history of
     * @param {number} before JS timestamp of history end
     * @param {number} after JS timestamp of history start
     * @async
     */
    _chat_history(username, channel, before, after) {
        return this._request("/chat_history.json", {chat_token: this.token, username, channel, before: before/1000, after: after/1000});
    }
    //#endregion

    //#region Events
    /**
     * Adds an event handler.
     * @param {string} name Event to add handler to.
     * @param {function} handler Handler
     */
    on(name, handler) {
        let eventStore = this.eventHandlers[name];
        if (!Array.isArray(eventStore)) throw "Invalid event name.";
        else eventStore.push(handler);
    }

    /**
     * Adds an event handler for every event.
     * @param {function} handler Handler
     */
    supervise(handler) {
        Object.keys(this.eventHandlers).forEach(function (eventStoreName) {
            let eventStore = this.eventHandlers[eventStoreName];
            eventStore.push(data => handler(eventStoreName, data));
        }.bind(this));
    }

    /**
     * FOR INTERNAL USE ONLY.
     * Send event data.
     * @param {string} name Event to send
     * @param {any} [data] Data of event
     * @private
     */
    _send_event(name, data) {
        let eventStore = this.eventHandlers[name];
        if (!Array.isArray(eventStore)) throw "Invalid event name.";
        else eventStore.forEach(handler => handler(data));
    }
    //#endregion

    /**
     * Creates a HackmudChatAPI instance.
     * If tokenOrPass is a chat pass, it converts it to a token.
     * Verifies token.
     * @param {string} tokenOrPass Hackmud chat token or chat pass.
     * @param {string} [url] Hackmud chat API URL. Defaults to default URL.
     */
    constructor(tokenOrPass, pollInterval = 2000, accountSyncInterval = 30*60*1000, url = "https://www.hackmud.com/mobile") {
        this.url = url;

        if (tokenOrPass.length == 5) { // If tokenOrPass is a pass...
            let done = false;
            let derr;

            this._get_token(tokenOrPass).then(function (res) { // Request a token from the API
                this.token = res.chat_token; // Store received token
                done = true;
            }.bind(this)).catch(function (err) {
                derr = err;
                done = true;
            })

            deasync.loopWhile(() => !done); // Wait until token gets here
            if (derr) throw derr; // If there was an error, throw it
        } else this.token = tokenOrPass; // If tokenOrPass is a token, store it

            // Sync account data for the first time.
            let done = false;
            let derr;

            this._sync_account_data()
                .then(() => {
                    done = true;
                }).catch(err => {
                    derr = err;
                    done = true;
                });

            deasync.loopWhile(() => !done);
            if (derr) this._send_event("error", derr);

        // Set up account sync interval
        this.accountSyncTimerID = setInterval(function accountSyncTimer() {
            this._sync_account_data()
                .catch(function (err) {
                    this._send_event("error", err);
                }.bind(this));
        }.bind(this), accountSyncInterval);

        this.lastPoll = Date.now(); // Set up last polling timestamp

        // Set up chat polling interval
        this.pollTimerID = setInterval(function pollTimer() {
            this._poll()
                .catch(function (err) {
                    this._send_event("error", err);
                }.bind(this));
        }.bind(this), pollInterval);
    }

    /**
     * Destroys HackmudChatAPI instance.
     * Clears timers.
     */
    destroy() {
        clearInterval(this.accountSyncTimerID);
        clearInterval(this.pollTimerID);
    }

    //#region Polling
    /**
     * Synchronizes account data between server and client.
     */
    async _sync_account_data() {
        let data = await this._account_data();
        this.users = Object.keys(data.users).reduce((a,x) => {a[x] = Object.keys(data.users[x]); return a}, {});
        this._send_event("accountSync", this.users);
    }

    /**
     * Poll chat messages from server.
     */
    async _poll() {
        //console.log(this.users);
        let chats = (await this._chats(Object.keys(this.users), undefined, this.lastPoll)).chats; // Poll chats
        //console.log(JSON.stringify(chats));

        // Assign each chat a to_user value
        Object.keys(chats).forEach(username => {
            chats[username] = chats[username].map(message => {
                message.t *= 1000;
                message.to_user = message.to_user || username;
                return message;
            })
        });

        // Concat all chats into one array
        chats = Object.values(chats).reduce((a,x) => a.concat(x), []);

        // Send out poll event
        this._send_event("poll", chats);
        
        // Update last poll timestamp
        this.lastPoll = Date.now();
    }
    //#endregion

    /**
     * Send a message to a channel.
     * @param {string} from User to send the message from
     * @param {string} channel Channel to send the message to
     * @param {string} message Message to send
     */
    async send(from, channel, message) {
        return await this._send(from, channel, message);
    }

    /**
     * Send a tell to a user.
     * @param {string} from User to send the tell from
     * @param {string} to User to send the tell to
     * @param {string} message Message to send
     */
    async tell(from, to, message) {
        return await this._tell(from, to, message);
    }

    /**
     * Get chat history.
     * Pretty broken, see: https://www.hackmud.com/forums/bugs_features_ideas/chat_api_chat_history_returns_empty_array_if_you_did_not_join_leave_the_specified_channel_between_the_specified_times
     * @param {string} username User to view the history from
     * @param {string} channel Channel to view the history of
     * @param {number} before JS timestamp of history end
     * @param {number} after JS timestamp of history start
     */
    async history(username, channel, before, after) {
        return await this._chat_history(username, channel, before, after);
    }
}

module.exports = HackmudChatAPI;