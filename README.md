# hackmud-chat-api
A client for the Hackmud Chat API.

[Additional docs for the chat API](https://www.hackmud.com/forums/general_discussion/chat_api_documentation)

## Installation
`npm i -s hackmud-chat-api` for module use

`npm i -g hackmud-chat-api` for CLI use

## CLI Usage

```
hm-pass2token <chat pass>
Converts your chat pass to a chat token.
```

## Usage example

```js
var HackmudChatAPI = require("hackmud-chat-api");
var chat = new HackmudChatAPI("YOUR_CHAT_TOKEN_OR_CHAT_PASS");
console.log(chat.token);

chat.on("poll", function pollHandler(messages) { // When messages are polled
    let cleanMessages = messages.filter(message => message.to_user == "my_bot_user" && messages.to_user != messages.from_user); // Filter messages. Only messages sent to bot user remains, and echo is removed.

    messages.forEach(message => { // For every message
        chat.tell("my_bot_user", "my_user", message.from_user + " said:\n" + message.msg); // Relay message to another user
    })
});
```

## Reference

### new HackmudChatAPI

Creates a HackmudChatAPI instance. Converts chat pass into chat token if needed, does initial account sync, and sets up timers.

Arguments:
 * tokenOrPass: Chat token or chat pass. If chat pass, it will be converted to chat token.
 * pollInterval: Polling frequency in milliseconds. Must be over 700ms to avoid ratelimits. Recommended to be over 2s. Default: 2s
 * accountSyncInterval: Account sync (updated usernames) frequency in milliseconds. Must be over 5s to avoid ratelimits, but a much bigger frequency is enough. Default: 30m
* url: URL of Chat API. Doesn't need to be touched. Default: `"https://www.hackmud.com/mobile"`

#### Properties

 * token: Chat token.
 * users: An object of users, where the user is the key, and an array of their joined channels is the value.
 * lastPoll: The JS timestamp of the last poll.

#### on

Adds an event handler.

Arguments:
 * name: Name of event. (`poll`, `error`, `accountSync`)
 * handler: Event handler. Argument:
   * `poll`: An array of messages.
   * `error`: An error.
   * `accountSync`: An object of users, where the user is the key, and an array of their joined channels is the value.

#### supervise

Adds an event handler for every event.

Arguments:
 * handler: Event handler. See argument above.

#### send

Sends a message to a channel.

Arguments:
 * `from`: Username to send the message from.
 * `channel`: Channel to send the message to.
 * `message`: Message to send.

Returns:
 * `ok`: Success?

#### tell

Sends a tell to a user.

Arguments:
 * `from`: Username to send the message from.
 * `to`: Username to send the message to.
 * `message`: Message to send.

Returns:
 * `ok`: Success?

#### destroy

Destroys HackmudChatAPI instance.

## Message

A message object.

Properties:
 * id: Message ID
 * t: JS timestamp of message
 * from_user: Username of sender
 * msg: Message
 * is_join: Whether the chat message is a channel join, not present if false
 * is_leave: Whether the chat message is a channel leave, not present if false
 * channel: Channel of message, not present in tells
 * to_user: Username of recipient