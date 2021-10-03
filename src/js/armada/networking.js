/**
 * Copyright 2021 Krisztián Nagy
 * @file Provides the networking functionality using WebSockets and WebRTC for multiplayer games.
 * Relies on a WebSocket server to discover, host and join games and connect with
 * the other players of the same game. If possible, establishes a direct WebRTC
 * connection with the host of the joined game (or all the guests if it is the host)
 * to communicate through.
 * Definitions:
 * - server / backend:
 * the WebSocket server application that provides an API for
 * hosting and discovering games and relaying messages between players (no game
 * logic, just managing the games and the players) This module sends and accepts
 * messages to / from the server.
 * - client:
 * an instance of this application running, can be either a host or a
 * guest (once it hosts or joins a game)
 * - host:
 * the player who started a game. Has authority over maintaining the
 * true game state. Accepts control messages from the other players and sends
 * updates about the game state to them regularly
 * - guest:
 * any player in a game who is not the host. Sends control messages to
 * the host and continuously maintains a local game state which is synchronized
 * with the game state of the host when an update is received from it.
 * - local player:
 * the player running this instance of this application
 * - general game message:
 * messages about hosting / joining games, connecting players, errors happening
 * and any other general purpose messages, sent as a stringified JSON
 * - game update message:
 * concise control and game state updates communicated between the host and guests
 * during the game as a Float32Array
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define */

/**
 * @typedef {Object} PlayerSettings
 * @property {Number[3]} color The RGB color to be used as the player's faction
 * color
 */
/**
 * @typedef {Object} PlayerStats
 * @property {Number} kills
 * @property {Number} deaths
 */
/** 
 * @typedef {Object} Player The model of a player as kept on this client
 * @property {String} name The name of the player (unique within the game)
 * @property {Boolean} peer Whether there is a peer to peer connection open
 * to this player (with the correct data channels set up and open)
 * @property {PlayerSettings} settings The settings the player sets for 
 * themselves
 * @property {Boolean} ready Whether the player is marked ready to play
 * @property {Number} ping The round trip time of messages to this player, in ms
 * @property {Boolean} waitPong Whether a ping message has been sent to the
 * player and we are waiting for the pong to arrive to calculate the ping time
 * @property {RTCPeerConnection} connection 
 * @property {RTCDataChannel} messageChannel To send and receive general game
 * messages as a stringified JSON
 * @property {RTCDataChannel} updateChannel To send and receive game update
 * messages as Float32Array
 * @property {PlayerStats} stats 
 */
/**
 * @typedef {Object} GameSettings
 * @property {String} environment The string ID of the environment to load for
 * the game
 * @property {String} loadout The string ID of the loadout to use for the player
 * spacecrafts
 */
/**
 * @typedef {Object} Game The model of the game state as kept on this client
 * @property {String} name The name of the game (unique within all games)
 * @property {String} host The name of the hosting player
 * @property {Player[]} players
 * @property {Number} maxPlayers Number of maximum allowed players, with the
 * host included
 * @property {GameSettings} settings The general settings for the game which
 * the host can change
 * @property {Boolean} started Whether the game has passed the lobby stage and
 * has already started (cannot join past this point)
 * @property {Boolean} own Marks the game the current client is in within the
 * list of games received from the server
 */

/**
 * @param application For logging
 * @param constants To get spacecraft update message data lengths
 */
define([
    "modules/application",
    "armada/logic/constants"
], function (application, constants) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            STUN_SERVER_URL = "stun:stun.l.google.com:19302",
            HEARTBEAT_INTERVAL = 15000,
            // --------------------------------
            // message types
            MSG_TYPE_LIST = 0,
            MSG_TYPE_HOST = 1,
            MSG_TYPE_JOIN = 2,
            MSG_TYPE_RTC_OFFER = 3,
            MSG_TYPE_RTC_ANSWER = 4,
            MSG_TYPE_TEXT = 5,
            MSG_TYPE_PING = 6,
            MSG_TYPE_PONG = 7,
            MSG_TYPE_LEAVE = 8,
            MSG_TYPE_ERROR = 9,
            MSG_TYPE_KICK = 10,
            MSG_TYPE_READY = 11,
            MSG_TYPE_START = 12,
            MSG_TYPE_LOADED = 13,
            MSG_TYPE_PEER_CONNECTED = 14,
            MSG_TYPE_PEER_DISCONNECTED = 15,
            MSG_TYPE_HEARTBEAT = 16,
            MSG_TYPE_GAME_SETTING = 17,
            MSG_TYPE_PLAYER_SETTING = 18,
            MSG_TYPE_PLAYER_STATS = 19,
            MSG_TYPE_MATCH_CONCLUDED = 20,
            // --------------------------------
            // error codes
            ERROR_CODE_GAME_NOT_FOUND = 0,
            ERROR_CODE_GAME_IS_FULL = 1,
            ERROR_CODE_GAME_ALREADY_STARTED = 2,
            ERROR_CODE_PLAYER_NAME_ALREADY_EXISTS = 3,
            ERROR_CODE_GAME_NAME_ALREADY_EXISTS = 4,
            ERROR_CODE_INVALID_GAME_SETTINGS = 5,
            // --------------------------------
            // other constants
            SPACECRAFT_HOST_DATA_LENGTH = constants.MULTI_HOST_DATA_LENGTH,
            GUEST_DATA_LENGTH = constants.MULTI_GUEST_DATA_LENGTH,
            GUEST_REPEAT_INTERVAL = 100,
            /** @type GameSettings */
            DEFAULT_GAME_SETTINGS = {
                environment: "reddim",
                loadout: "multi-tier1"
            },
            // ------------------------------------------------------------------------------
            // private variables
            /** @type String */
            _serverUrl,
            /** @type Number */
            _serverPing,
            /** @type WebSocket */
            _socket,
            /** @type Boolean */
            _socketOpen,
            /** @type Array */
            _onOpen,
            /** @type Function[][] */
            _messageHandlers,
            /** @type String */
            _playerName,
            /** @type Boolean */
            _isHost,
            /** @type Boolean */
            _hostIsPeer,
            /** @type Game */
            _game,
            /** @type Function */
            _onConnect,
            /** @type Function */
            _onDisconnect,
            /** @type Function */
            _onError,
            /** @type Function */
            _onPlayerJoin,
            /** @type Function */
            _onPlayerLeave,
            /** @type Function */
            _onPlayerReady,
            /** @type Function */
            _onPlayerKicked,
            /** @type Function */
            _onPlayerUpdate,
            /** @type Function */
            _onGameSettingsChanged,
            /** @type Function */
            _onKicked,
            /** @type Function */
            _onText,
            /** @type Function */
            _onHostLeft,
            /** @type Function */
            _onGameStart,
            /** @type Function */
            _onGameUpdate,
            /** @type Function */
            _onMatchConcluded,
            /** @type DOMHighResTimeStamp */
            _serverPingTime,
            /** @type DOMHighResTimeStamp */
            _pingTime,
            /** @type Number */
            _heartbeatInterval = -1,
            /** @type Number */
            _lastGuestUpdateTime = 0,
            /** @type Float32Array */
            _lastGuestUpdate = new Float32Array(GUEST_DATA_LENGTH).fill(0),
            /** @type Function */
            _processMessage;
    // -------------------------------------------------------------------------
    // Private methods
    /**
     * Adds the passed callback to the list of functions to be called when the
     * next message with the passed type arrives
     * @param {Number} messageType
     * @param {Function} callback
     * @param {Boolean} [replace=false] Whether to replace any previously added
     * callbacks for this message type with the passed one instead of adding it
     * to them
     */
    function _onMessage(messageType, callback, replace) {
        _messageHandlers[messageType] = replace ? [] : (_messageHandlers[messageType] || []);
        _messageHandlers[messageType].push(callback);
    }
    /**
     * Send a message through the socket containing the passed JSON, and execute
     * the passed callback when the first message with the same type as 
     * specified in the JSON arrives.
     * @param {Object} data
     * @param {Function} [callback]
     * @param {Boolean} [replace=false] Whether to replace any previously added
     * callbacks for this message type with the passed one instead of adding it
     * to them
     */
    function _sendJSONtoSocket(data, callback, replace) {
        var message = JSON.stringify(data);
        if (_socketOpen) {
            if (callback) {
                _onMessage(data.type, callback, replace);
            }
            _socket.send(message);
        } else {
            _onOpen.push([data, callback, replace]);
        }
    }
    /**
     * Whether the passed player model belongs to the player corresponding to
     * this game client
     * @param {Player} player
     * @returns {Boolean}
     */
    function _playerIsMe(player) {
        return player.name === _playerName;
    }
    /**
     * Whether there is a peer to peer connection open to the passed player
     * @param {Player} player
     * @returns {Boolean}
     */
    function _playerIsPeer(player) {
        return player.peer === true;
    }
    /**
     * Returns the player model corresponding to this game client
     * @returns {Player}
     */
    function _findMe() {
        if (_game) {
            return _game.players.find(_playerIsMe);
        }
        return null;
    }
    /**
     * Returns the index of the local player within the players array of the
     * game
     * @returns {Number}
     */
    function _getPlayerIndex() {
        if (_game) {
            return _game.players.findIndex(_playerIsMe);
        }
        return -1;
    }
    /**
     * Returns the player model corresponding to the player with the passed name
     * within the current game
     * @param {String} name
     * @returns {Player}
     */
    function _findPlayer(name) {
        if (_game) {
            return _game.players.find(function (player) {
                return player.name === name;
            });
        }
        return null;
    }
    /**
     * Returns an array containing the indices of all the other players in the
     * current game player list
     * @returns {Number[]}
     */
    function _getOtherPlayerIndices() {
        var i, result = [];
        if (_game) {
            for (i = 0; i < _game.players.length; i++) {
                if (!_playerIsMe(_game.players[i])) {
                    result.push(i);
                }
            }
        }
        return result;
    }
    /**
     * Return whether the passed game is our own game (in which the local client
     * is taking part)
     * @param {Game} game
     */
    function _gameIsOwn(game) {
        return game.own === true;
    }
    /**
     * Stop sending heartbeat messages through the socket
     */
    function _cancelHeartbeat() {
        if (_heartbeatInterval !== -1) {
            clearInterval(_heartbeatInterval);
            _heartbeatInterval = -1;
        }
    }
    /**
     * Start sending heartbeat messages at regular intervals through the socket
     */
    function _setupHeartbeat() {
        if (_heartbeatInterval === -1) {
            _heartbeatInterval = setInterval(function () {
                if (_socketOpen) {
                    _socket.send(JSON.stringify({
                        type: MSG_TYPE_HEARTBEAT
                    }));
                } else {
                    _cancelHeartbeat();
                }
            }, HEARTBEAT_INTERVAL);
        }
    }
    /**
     * Process a received game update message (a Float32Array, received either
     * through the WebSocket or an RTC connection) using the callback set by 
     * onGameUpdate(). Return to general message processing if the update is an 
     * empty array
     * @param {MessageEvent} event
     */
    function _processGameUpdate(event) {
        var data = new Float32Array(event.data);
        if (data.length === 0) {
            _socket.binaryType = 'blob';
            _socket.onmessage = _processMessage;
            _cancelHeartbeat();
        } else {
            if (_onGameUpdate) {
                _onGameUpdate(data);
            }
        }
    }
    /**
     * Process a player stat update message
     * @param {Object} data The parsed JSON data of the message
     */
    function _processPlayerStats(data) {
        var i, player;
        if (_game) {
            for (i = 0; i < data.players.length; i++) {
                player = _findPlayer(data.players[i].name);
                if (player) {
                    Object.assign(player.stats, data.players[i].stats);
                } else {
                    application.log_DEBUG("Could not find player '" + data.players[i].name + "'!", 1);
                }
            }
        }
    }
    /**
     * Close the existing RTCDataChannels and RTCPeerConnection with the passed
     * player if they exist and are open
     * @param {Player} player
     */
    function _closePeerConnection(player) {
        if (_playerIsPeer(player)) {
            application.log_DEBUG("Closing peer connection with player " + player.name + "!", 2);
            if (player.messageChannel) {
                if (player.messageChannel.readyState === "open") {
                    player.messageChannel.close();
                }
                player.messageChannel = null;
            }
            if (player.updateChannel) {
                if (player.updateChannel.readyState === "open") {
                    player.updateChannel.close();
                }
                player.updateChannel = null;
            }
            if (player.connection) {
                player.connection.close();
                player.connection = null;
            }
        }
    }
    /**
     * Delete the current game state model and event callbacks and close peer 
     * connections to all other players.
     */
    function _destroyGame() {
        if (_game) {
            _game.players.forEach(function (player) {
                if (!_playerIsMe(player)) {
                    _closePeerConnection(player);
                }
            });
        }
        _game = null;
        _isHost = false;
        _onPlayerJoin = null;
        _onPlayerLeave = null;
        _onPlayerReady = null;
        _onPlayerKicked = null;
        _onPlayerUpdate = null;
        _onGameSettingsChanged = null;
        _onKicked = null;
        _onText = null;
        _onHostLeft = null;
        _onGameStart = null;
        _onGameUpdate = null;
        _onMatchConcluded = null;
    }
    /**
     * Set up the event listeners for an RTCDataChannel that is to be used for
     * sending / receiving general game messages (stringified JSONs) to/from
     * the passed player
     * @param {RTCDataChannel} channel
     * @param {Player} player
     */
    function _setupMessageDataChannel(channel, player) {
        channel.onopen = function () {
            player.peer = true;
            if (!_isHost) {
                _hostIsPeer = true;
            }
            application.log_DEBUG("RTC message data channel open!", 3);
            if (_socketOpen) {
                _socket.send(JSON.stringify({
                    type: MSG_TYPE_PEER_CONNECTED,
                    playerName: player.name
                }));
            }
            if (_onPlayerUpdate) {
                _onPlayerUpdate(player);
            }
        };
        channel.onclose = function () {
            player.peer = false;
            if (!_isHost) {
                _hostIsPeer = false;
            }
            application.log_DEBUG("RTC message data channel closed!", 3);
            if (_socketOpen) {
                _socket.send(JSON.stringify({
                    type: MSG_TYPE_PEER_DISCONNECTED,
                    playerName: player.name
                }));
            }
            if (_onPlayerUpdate) {
                _onPlayerUpdate(player);
            }
        };
        channel.onmessage = function (event) {
            application.log_DEBUG("RTC message received:", 3);
            application.log_DEBUG(event, 3);
            const data = JSON.parse(event.data);
            switch (data.type) {
                case MSG_TYPE_PING:
                    channel.send(JSON.stringify({
                        type: MSG_TYPE_PONG
                    }));
                    break;
                case MSG_TYPE_PONG:
                    player.ping = performance.now() - _pingTime;
                    player.waitPong = false;
                    if (_onPlayerUpdate) {
                        _onPlayerUpdate(player);
                    }
                    break;
                case MSG_TYPE_PLAYER_STATS:
                    _processPlayerStats(data);
                    break;
                case MSG_TYPE_MATCH_CONCLUDED:
                    _processPlayerStats(data);
                    if (_onMatchConcluded) {
                        _onMatchConcluded();
                    }
                    _destroyGame();
                    break;
            }
        };
    }
    /**
     * Set up the event listeners for an RTCDataChannel that is to be used for
     * sending / receiving game update messages (Float32Arrays)
     * @param {RTCDataChannel} channel
     */
    function _setupUpdateDataChannel(channel) {
        channel.onopen = function () {
            application.log_DEBUG("RTC update data channel open!", 3);
        };
        channel.onclose = function () {
            application.log_DEBUG("RTC update data channel closed!", 3);
        };
        channel.onmessage = _processGameUpdate;
    }
    /**
     * Completely set up a peer connection with the passed player if possible,
     * including negotiating the offer and answer and opening the appropriate
     * RTCDataChannels. If the process is successful, the 'peer' field of the
     * player model will be set to true.
     * @param {Player} player
     * @param {String} [offerData] The guest should pass the offer data sent
     * by the host here (leave it empty for the host)
     */
    function _createPeerConnection(player, offerData) {
        var messageChannel, updateChannel, connection;
        connection = new RTCPeerConnection({'iceServers': [{'urls': STUN_SERVER_URL}]});
        player.connection = connection;
        application.log_DEBUG("Created RTC peer connection", 2);
        connection.onicegatheringstatechange = function () {
            application.log_DEBUG("ICE gathering state changed", 3);
            if (connection.iceGatheringState === "complete") {
                if (_isHost) {
                    application.log_DEBUG("Sending RTC offer", 2);
                    _sendJSONtoSocket({
                        type: MSG_TYPE_RTC_OFFER,
                        offer: connection.localDescription,
                        playerName: player.name
                    });
                } else {
                    application.log_DEBUG("Sending RTC answer", 2);
                    _sendJSONtoSocket({
                        type: MSG_TYPE_RTC_ANSWER,
                        answer: connection.localDescription
                    });
                }
            }
        };
        connection.ondatachannel = function (event) {
            application.log_DEBUG("RTC data channel received!", 3);
            switch (event.channel.label) {
                case "messageChannel":
                    player.messageChannel = event.channel;
                    _setupMessageDataChannel(player.messageChannel, player);
                    break;
                case "updateChannel":
                    player.updateChannel = event.channel;
                    _setupUpdateDataChannel(player.updateChannel);
                    break;
                default:
                    application.log_DEBUG("Error: unknown DataChannel type: " + event.channel.label, 1);
            }
        };
        if (_isHost) {
            messageChannel = connection.createDataChannel("messageChannel");
            player.messageChannel = messageChannel;
            application.log_DEBUG("RTC message data channel created!", 3);
            _setupMessageDataChannel(messageChannel, player);
            updateChannel = connection.createDataChannel("updateChannel");
            player.updateChannel = updateChannel;
            application.log_DEBUG("RTC update data channel created!", 3);
            _setupUpdateDataChannel(updateChannel);
            connection.createOffer().then(function (description) {
                connection.setLocalDescription(description);
                application.log_DEBUG("Created RTC offer", 3);
            }, function () {
                application.log_DEBUG("Error creating RTC offer!", 1);
            });
        } else {
            connection.setRemoteDescription(new RTCSessionDescription(offerData));
            connection.createAnswer(function (description) {
                connection.setLocalDescription(description);
                application.log_DEBUG("Created RTC answer", 3);
            }, function () {
                application.log_DEBUG("Error creating RTC answer!", 1);
            });
        }
    }
    /**
     * As host, send the passed general game message object to all the guests
     * using the fastest method available (RTC if possible, WebSocket if not)
     * @param {Object} message
     * @param {Boolean} [force=false] Send a message though the WebSocket (with
     * empty recipient list) even if all guests can be reached by RTC (to keep
     * the socket connection alive)
     */
    function _hostSend(message, force) {
        var recipients = [];
        _game.players.forEach(function (player, index) {
            if (index !== 0) {
                if (_playerIsPeer(player)) {
                    application.log_DEBUG("Sending to " + player.name + " via RTC", 3);
                    player.messageChannel.send(JSON.stringify(message));
                } else {
                    recipients.push(index);
                }
            }
        });
        if ((recipients.length > 0) || force) {
            application.log_DEBUG("Sending to all other players via WebSocket", 3);
            message.recipients = recipients;
            _socket.send(JSON.stringify(message));
        }
    }
    /**
     * As a guest, send the passed general game message object to all the other
     * players using the fastest method available (RTC if possible, WebSocket if
     * not)
     * @param {Object} message
     * @param {Boolean} [force=false] Send a message though the WebSocket (with
     * empty recipient list) even if all guests can be reached by RTC (to keep
     * the socket connection alive)
     */
    function _guestSendFastest(message, force) {
        var i, recipients = [];
        if (_playerIsPeer(_game.players[0])) {
            application.log_DEBUG("Sending to host " + _game.players[0].name + " via RTC", 3);
            _game.players[0].messageChannel.send(JSON.stringify(message));
        } else {
            recipients.push(0);
        }
        for (i = 1; i < _game.players.length; i++) {
            if (!_playerIsMe(_game.players[i])) {
                recipients.push(i);
            }
        }
        if ((recipients.length > 0) || force) {
            application.log_DEBUG("Sending to all other players via WebSocket", 3);
            message.recipients = recipients;
            _socket.send(JSON.stringify(message));
        }
    }
    /**
     * Process a general game message (a stringified JSON with a type field with
     * one of the MGS_TYPE_... constant values) Using both builtin logic to
     * maintain the game and player state models and using the appropriate
     * callbacks (such as the ones set by onPlayerJoin(), onPlayerReady() etc)
     * @param {MessageEvent} event
     */
    _processMessage = function (event) {
        var i, player, playerIndex, data, serverNeeded;
        application.log_DEBUG("Socket message received!", 3);
        application.log_DEBUG(event, 3);
        if ((typeof event.data) !== "string") {
            return;
        }
        data = JSON.parse(event.data);
        switch (data.type) {
            case MSG_TYPE_LIST:
                _serverPing = performance.now() - _serverPingTime;
                _serverPingTime = 0;
                break;
            case MSG_TYPE_JOIN:
                if (_game) {
                    player = {name: data.player.name, peer: false, ready: false, me: false, settings: data.player.settings, stats: data.player.stats};
                    _game.players.push(player);
                    if (_onPlayerJoin) {
                        _onPlayerJoin(data.player.name);
                    }
                    if (_isHost) {
                        _createPeerConnection(player);
                    }
                }
                break;
            case MSG_TYPE_LEAVE:
                if (_game) {
                    playerIndex = _game.players.findIndex(function (p) {
                        return p.name === data.playerName;
                    });
                    if (playerIndex === 0) {
                        application.log_DEBUG("Host " + _game.players[0].name + " left the game, the game " + _game.name + " is destroyed", 2);
                        if (_onHostLeft) {
                            _onHostLeft();
                        }
                        _destroyGame();
                    } else if (playerIndex > 0) {
                        player = _game.players[playerIndex];
                        _closePeerConnection(player);
                        _game.players.splice(playerIndex, 1);
                        if (_onPlayerLeave) {
                            _onPlayerLeave(player);
                        }
                    } else {
                        application.log_DEBUG("Could not find player '" + data.playerName + "'!", 1);
                    }
                }
                break;
            case MSG_TYPE_ERROR:
                if (_onError) {
                    _onError(data.errorCode);
                }
                break;
            case MSG_TYPE_RTC_OFFER:
                if (_game) {
                    _createPeerConnection(_game.players[0], data.offer);
                }
                break;
            case MSG_TYPE_RTC_ANSWER:
                player = _findPlayer(data.playerName);
                if (player) {
                    application.log_DEBUG("Received RTC answer!", 2);
                    player.connection.setRemoteDescription(new RTCSessionDescription(data.answer));
                } else {
                    application.log_DEBUG("Could not find player '" + data.playerName + "'!", 1);
                }
                break;
            case MSG_TYPE_TEXT:
                if (_onText) {
                    _onText(data);
                }
                break;
            case MSG_TYPE_PING:
                _socket.send(JSON.stringify({
                    type: MSG_TYPE_PONG,
                    recipient: data.sender
                }));
                break;
            case MSG_TYPE_PONG:
                if (_game) {
                    player = _game.players[data.sender];
                    if (player) {
                        player.ping = performance.now() - _pingTime;
                        player.waitPong = false;
                        if (_onPlayerUpdate) {
                            _onPlayerUpdate(player);
                        }
                    } else {
                        application.log_DEBUG("ERROR: Invalid pong sender index" + data.sender + "!", 1);
                    }
                }
                break;
            case MSG_TYPE_KICK:
                if (_game) {
                    if (data.playerName === _playerName) {
                        if (_onKicked) {
                            _onKicked();
                        }
                        _destroyGame();
                    } else {
                        playerIndex = _game.players.findIndex(function (player) {
                            return player.name === data.playerName;
                        });
                        player = _game.players[playerIndex];
                        _closePeerConnection(player);
                        _game.players.splice(playerIndex, 1);
                        if (_onPlayerKicked) {
                            _onPlayerKicked(player);
                        }
                        if (_onPlayerUpdate) {
                            _onPlayerUpdate(player);
                        }
                    }
                }
                break;
            case MSG_TYPE_READY:
                if (_game) {
                    player = _findPlayer(data.playerName);
                    if (player) {
                        player.ready = true;
                        if (_onPlayerReady) {
                            _onPlayerReady(player);
                        }
                        if (_onPlayerUpdate) {
                            _onPlayerUpdate(player);
                        }
                    } else {
                        application.log_DEBUG("Could not find player '" + data.playerName + "'!", 1);
                    }
                }
                break;
            case MSG_TYPE_START:
                if (_game) {
                    if (!_game.started) {
                        _game.started = true;
                    } else {
                        if (_isHost) {
                            serverNeeded = false;
                            for (i = 1; i < _game.players.length; i++) {
                                if (!_playerIsPeer(_game.players[i])) {
                                    serverNeeded = true;
                                    break;
                                }
                            }
                        } else {
                            serverNeeded = !_hostIsPeer;
                        }
                        if (serverNeeded) {
                            _socket.binaryType = 'arraybuffer';
                            _socket.onmessage = _processGameUpdate;
                        } else {
                            _setupHeartbeat();
                        }
                    }
                    if (_onGameStart) {
                        _onGameStart();
                    }
                }
                break;
            case MSG_TYPE_GAME_SETTING:
                if (_game && !_game.started) {
                    Object.assign(_game.settings, data.settings);
                    if (_onGameSettingsChanged) {
                        _onGameSettingsChanged();
                    }
                }
                break;
            case MSG_TYPE_PLAYER_SETTING:
                if (_game) {
                    player = _findPlayer(data.playerName);
                    if (player) {
                        Object.assign(player.settings, data.settings);
                        if (_onPlayerUpdate) {
                            _onPlayerUpdate(player);
                        }
                    } else {
                        application.log_DEBUG("Could not find player '" + data.playerName + "'!", 1);
                    }
                }
                break;
            case MSG_TYPE_PLAYER_STATS:
                _processPlayerStats(data);
                // if we have a peer connection, player stat update messages are
                // sent through it
                // so if we got one via the WebSocket, that means we are in a game
                // connected through the server, so we need to switch back to game
                // update processing after processing this message
                _socket.binaryType = 'arraybuffer';
                _socket.onmessage = _processGameUpdate;
                break;
            case MSG_TYPE_MATCH_CONCLUDED:
                _processPlayerStats(data);
                if (_onMatchConcluded) {
                    _onMatchConcluded();
                }
                _destroyGame();
                break;
        }
        if (_messageHandlers[data.type]) {
            for (i = 0; i < _messageHandlers[data.type].length; i++) {
                _messageHandlers[data.type][i](data);
            }
            _messageHandlers[data.type].length = 0;
        }
    };
    /**
     * Send the passed guest game update data to the host using the fastest
     * method available
     * @param {DOMHighResTimeStamp} now The current timestamp obtained via
     * performance.now()
     * @param {Float32Array} data
     */
    function _sendGuestUpdate(now, data) {
        if (_hostIsPeer) {
            _game.players[0].updateChannel.send(data);
        } else {
            _socket.send(data);
        }
        _lastGuestUpdate.set(data);
        _lastGuestUpdateTime = now;
    }
    // -------------------------------------------------------------------------
    // Public methods
    /**
     * Initialize the module (does not establish connection).
     * Call before anything else
     * @param {String} serverUrl The base URL of the multiplayer WebSocket 
     * backend
     */
    function init(serverUrl) {
        _serverUrl = serverUrl;
        _socket = null;
        _socketOpen = false;
        _onOpen = [];
        _messageHandlers = {};
        _game = null;
        _isHost = false;
    }
    /**
     * Whether there is connection open towards the server
     * @returns {Boolean}
     */
    function isConnected() {
        return _socket && _socketOpen;
    }
    /**
     * Establish a connection to the WebSocket server
     */
    function connect() {
        var i;
        if (!_socket) {
            _socketOpen = false;
            _socket = new WebSocket(_serverUrl);
            _socket.binaryType = 'blob';
            _socket.onopen = function () {
                var data;
                application.log_DEBUG("Connected to the multiplayer server!", 1);
                _socketOpen = true;
                for (i = 0; i < _onOpen.length; i++) {
                    data = _onOpen[i][0];
                    if (_onOpen[i][1]) {
                        _onMessage(data.type, _onOpen[i][1], _onOpen[i][2]);
                    }
                    _socket.send(JSON.stringify(data));
                }
                _onOpen.length = 0;
                if (_onConnect) {
                    _onConnect();
                }
            };
            _socket.onclose = function () {
                application.log_DEBUG("Disconnected from the multiplayer server!", 1);
                if (_onDisconnect) {
                    _onDisconnect(_socketOpen);
                }
                _destroyGame();
                _socketOpen = false;
                _socket = null;
            };
            _socket.onmessage = _processMessage;
        }
    }
    /**
     * Close all WebRTC and WebSocket connections, delete local game state
     * information (server will notify other players in the game that this 
     * player left)
     */
    function disconnect() {
        if (_socket && _socketOpen) {
            if (_game) {
                _destroyGame();
            }
            _socketOpen = false;
            _socket.close();
        }
    }
    /**
     * Returns the round trip time of messages to the WebSocket server
     * @returns {Number}
     */
    function getServerPing() {
        return _serverPing;
    }
    /**
     * Returns the currently set name for the local player
     * @returns {String}
     */
    function getPlayerName() {
        return _playerName;
    }
    /**
     * Set a name for the player to be used when joining games (names must be
     * unique within a game, attempting to join a game with a name that already
     * exists results in an error from the server and will prompt the player
     * to enter a new name)
     * @param {String} value
     */
    function setPlayerName(value) {
        _playerName = value;
    }
    /**
     * Returns the currently set settings for the local player
     * @returns {PlayerSettings}
     */
    function getPlayerSettings() {
        return _findMe().settings;
    }
    /**
     * Update the player settings and notify the other players about the update.
     * Only works before marking ready to play.
     * @param {PlayerSettings} updatedSettings
     */
    function updatePlayerSettings(updatedSettings) {
        if (!_findMe().ready) {
            Object.assign(_findMe().settings, updatedSettings);
            _sendJSONtoSocket({
                type: MSG_TYPE_PLAYER_SETTING,
                settings: updatedSettings
            });
        }
    }
    /**
     * Whether the local player is currently in a game (as host or guest, in the
     * lobby or playing)
     * @returns {Boolean}
     */
    function isInGame() {
        return !!_game;
    }
    /**
     * Whether the local player is the host of the game they are in
     * @returns {Boolean}
     */
    function isHost() {
        return _isHost;
    }
    /**
     * Returns the name of the current (hosted or joined) game
     * @returns {String}
     */
    function getGameName() {
        return _game ? _game.name : "";
    }
    /**
     * Returns the general game settings, which the host has authority to change
     * @returns {GameSettings}
     */
    function getGameSettings() {
        return _game ? _game.settings : null;
    }
    /**
     * Returns the name of the hosting player of the current (hosted or joined)
     * game
     * @returns {String}
     */
    function getHostName() {
        return _game ? _game.players[0].name : "";
    }
    /**
     * Ask the server to return the list of currently active games, and call the
     * passed callback function when the list is returned
     * @param {Function} callback The message data JSON is passed to this when
     * called (the "games" field contains the list of games)
     */
    function listGames(callback) {
        if (!_serverPingTime) {
            _serverPingTime = performance.now();
        }
        _sendJSONtoSocket({
            type: MSG_TYPE_LIST
        }, callback, true);
    }
    /**
     * @typedef {Object} CreateGameParams
     * @property {String} gameName 
     * @property {Number} maxPlayers 
     */
    /**
     * Instruct the server to create a new game with this player being the host
     * using the passed parameters, and calls the callback function once the 
     * game is successfully created. If there is an error on the server side
     * during creation, the callback set by onError() will be called instead
     * @param {CreateGameParams} params
     * @param {Function} callback
     */
    function createGame(params, callback) {
        _sendJSONtoSocket({
            type: MSG_TYPE_HOST,
            playerName: _playerName,
            gameName: params.gameName,
            settings: DEFAULT_GAME_SETTINGS,
            maxPlayers: params.maxPlayers
        }, function (data) {
            /** @type Game */
            var gameInfo = data.games.find(_gameIsOwn);
            if (!gameInfo) {
                application.log_DEBUG("Game could not be created!", 1);
                return;
            }
            _game = {
                host: gameInfo.host,
                name: gameInfo.name,
                players: [{name: _playerName, ping: 0, peer: false, ready: false, me: true, settings: gameInfo.players[0].settings, stats: gameInfo.players[0].stats}],
                maxPlayers: gameInfo.maxPlayers,
                settings: gameInfo.settings,
                started: false
            };
            _isHost = true;
            callback();
        }, true);
    }
    /**
     * As a host, update the general game settings and notify the guests about
     * the update
     * @param {GameSettings} updatedSettings
     */
    function updateGameSettings(updatedSettings) {
        if (_isHost) {
            Object.assign(_game.settings, updatedSettings);
            _sendJSONtoSocket({
                type: MSG_TYPE_GAME_SETTING,
                settings: updatedSettings
            });
        }
    }
    /**
     * Set the callback to be executed once the client has successfully 
     * connected to the WebSocket server
     * @param {Function} callback
     */
    function onConnect(callback) {
        _onConnect = callback;
    }
    /**
     * Set the callback to be executed when the client disconnects from the
     * WebSocket server
     * @param {Function} callback
     */
    function onDisconnect(callback) {
        _onDisconnect = callback;
    }
    /**
     * Set the callback to be executed whenever an error happens on the server
     * side (and the server notifies the client of it)
     * @param {Function} callback A number corresponding to one of the
     * ERROR_CODE_... constants is passed as an argument
     */
    function onError(callback) {
        _onError = callback;
    }
    /**
     * Set the callback to be executed whenever a new player joins the current
     * game
     * @param {Function} callback The name of the new player is passed as an
     * argument
     */
    function onPlayerJoin(callback) {
        _onPlayerJoin = callback;
    }
    /**
     * Set the callback to be executed whenever a player leaves the current game
     * @param {Function} callback The player model corresponding to the player
     * who left is passed as an argument
     */
    function onPlayerLeave(callback) {
        _onPlayerLeave = callback;
    }
    /**
     * Set the callback to be executed whenever a player marks they are ready to
     * start the game
     * @param {Function} callback The player model corresponding to the player
     * who marked ready is passed as an argument
     */
    function onPlayerReady(callback) {
        _onPlayerReady = callback;
    }
    /**
     * Set the callback to be executed whenever a player is kicked from the 
     * current game by the host
     * @param {Function} callback The player model corresponding to the player
     * who was kicked is passed as an argument
     */
    function onPlayerKicked(callback) {
        _onPlayerKicked = callback;
    }
    /**
     * Set the callback to be executed whenever the model corresponding to one
     * of the players of the current game changes (e.g. peer to peer connection
     * is established or lost, ping value has been updated, player marked ready)
     * @param {Function} callback The changed player model is passed as an 
     * argument
     */
    function onPlayerUpdate(callback) {
        _onPlayerUpdate = callback;
    }
    /**
     * Set the callback to be executed whenever the general game settings are
     * changed by the host (will only be called at the guests)
     * @param {Function} callback
     */
    function onGameSettingsChanged(callback) {
        _onGameSettingsChanged = callback;
    }
    /**
     * Set the callback to be executed when the local player is kicked from the 
     * current game by the host
     * @param {Function} callback
     */
    function onKicked(callback) {
        _onKicked = callback;
    }
    /**
     * Set the callback to be executed when a text message is received from one
     * of the other players of the current game
     * @param {Function} callback The message data is passed as an argument.
     * Has the fields:
     * text: the actual message text
     * sender: the name of the player who sent the message
     */
    function onText(callback) {
        _onText = callback;
    }
    /**
     * Set the callback to be executed when the host leaves the current game and
     * so its model is destroyed and it is no longer synchronized
     * @param {Function} callback
     */
    function onHostLeft(callback) {
        _onHostLeft = callback;
    }
    /**
     * Set the callback to be executed when the host starts the current game and
     * once again when all players have loaded in and the game actually starts
     * @param {Function} callback
     */
    function onGameStart(callback) {
        _onGameStart = callback;
    }
    /**
     * Set the callback to be executed when a game update message (control 
     * update from a guest to the host or game state update from the host to a
     * guest) is received
     * @param {Function} callback The Float32Array that is the game update data
     * is passed as an argument
     */
    function onGameUpdate(callback) {
        _onGameUpdate = callback;
    }
    /**
     * Set the callback to be executed when the match concluded message is
     * received from the host to a guest
     * @param {Function} callback
     */
    function onMatchConcluded(callback) {
        _onMatchConcluded = callback;
    }
    /**
     * @typedef {Object} JoinGameParams
     * @property {String} gameName 
     */
    /**
     * Asks the server to add the local player to the game identified by the
     * params. Calls the callback function if and when the player has 
     * successfully joined the game. If there is an error on the server side
     * during joining, the callback set by onError() will be called instead
     * @param {JoinGameParams} params
     * @param {Function} callback
     */
    function joinGame(params, callback) {
        _sendJSONtoSocket({
            type: MSG_TYPE_JOIN,
            playerName: _playerName,
            gameName: params.gameName
        }, function (data) {
            var i;
            _game = {
                name: data.gameName,
                players: data.players,
                settings: data.settings,
                started: false
            };
            for (i = 0; i < _game.players.length; i++) {
                _game.players[i].me = _playerIsMe(_game.players[i]);
            }
            _isHost = false;
            callback();
        }, true);
    }
    /**
     * Notifies the server that this player has left the current game. Destroys
     * local game state data and callbacks.
     */
    function leaveGame() {
        if (_game) {
            _sendJSONtoSocket({
                type: MSG_TYPE_LEAVE
            });
            _destroyGame();
        }
    }
    /**
     * Instructs the server to kick out the player with the passed name from the
     * current game. Will only have an effect if the local player is the host
     * of the game.
     * @param {String} name
     */
    function kickPlayer(name) {
        _sendJSONtoSocket({
            type: MSG_TYPE_KICK,
            playerName: name
        });
    }
    /**
     * Returns the list of player models for the current game.
     * @returns {Player[]}
     */
    function getPlayers() {
        return _game ? _game.players : [];
    }
    /**
     * Sends a ping message to all the other players in the game, and updates
     * the ping values in their models as the pong answers arrive. Uses the
     * fastest method available (WebRTC if possible, through the server if not)
     */
    function ping() {
        var i, index;
        if (!_game || _game.started) {
            return;
        }
        if (_isHost) {
            for (i = 1; i < _game.players.length; i++) {
                if (_game.players[i].waitPong) {
                    return;
                }
                _game.players[i].waitPong = true;
            }
            application.log_DEBUG("Host ping", 3);
            _pingTime = performance.now();
            _hostSend({
                type: MSG_TYPE_PING,
                sender: 0
            }, true);
        } else {
            for (i = 0; i < _game.players.length; i++) {
                if (!_playerIsMe(_game.players[i])) {
                    if (_game.players[i].waitPong) {
                        return;
                    }
                    _game.players[i].waitPong = true;
                } else {
                    index = i;
                }
            }
            application.log_DEBUG("Guest ping", 3);
            _pingTime = performance.now();
            _guestSendFastest({
                type: MSG_TYPE_PING,
                sender: index
            }, true);
        }
    }
    /**
     * Sends the passed text message to the players with the passed indices in
     * the current game through the WebSocket server.
     * @param {String} text
     * @param {Number[]} recipients
     */
    function sendText(text, recipients) {
        _sendJSONtoSocket({
            type: MSG_TYPE_TEXT,
            text: text,
            sender: _playerName,
            recipients: recipients || _getOtherPlayerIndices()
        });
    }
    /**
     * Marks this player as ready to start the game and notifies the server of
     * this.
     */
    function markReady() {
        var me = _findMe();
        if (!me.ready) {
            _sendJSONtoSocket({
                type: MSG_TYPE_READY
            });
            me.ready = true;
            if (_onPlayerUpdate) {
                _onPlayerUpdate(me);
            }
        }
    }
    /**
     * Whether all of the players in the game have marked as ready to start the
     * game.
     * @returns {Boolean}
     */
    function allPlayersReady() {
        var i;
        if (!_game || (_game.players.length < 2)) {
            return false;
        }
        for (i = 1; i < _game.players.length; i++) {
            if (!_game.players[i].ready) {
                return false;
            }
        }
        return true;
    }
    /**
     * Sends a start message to the WebSocket server. Only has an effect if the
     * local player is the host of the current game and all other players have
     * marked ready.
     */
    function startGame() {
        if (_isHost && allPlayersReady()) {
            _sendJSONtoSocket({
                type: MSG_TYPE_START
            });
        }
    }
    /**
     * Notifies the server that the local client has finished loading the game.
     */
    function markLoaded() {
        _sendJSONtoSocket({
            type: MSG_TYPE_LOADED
        });
    }
    /**
     * Update the player stats when one player kills another
     * @param {String} killerName Name of the player who scored the kill
     * @param {String} victimName Name of the player who has been killed
     */
    function registerPlayerKill(killerName, victimName) {
        var killer, victim, players = [];
        if (_isHost) {
            killer = _findPlayer(killerName);
            if (killer) {
                killer.stats.kills++;
                players.push({
                    name: killerName,
                    stats: killer.stats
                });
            }
            victim = _findPlayer(victimName);
            if (victim) {
                victim.stats.deaths++;
                players.push({
                    name: victimName,
                    stats: victim.stats
                });
            }
            if (players.length > 0) {
                _hostSend({
                    type: MSG_TYPE_PLAYER_STATS,
                    players: players
                });
            }
        }
    }
    /**
     * Concludes the current multiplayer game, sending the results to all players
     */
    function concludeMatch() {
        if (_isHost) {
            _hostSend({
                type: MSG_TYPE_MATCH_CONCLUDED,
                players: _game.players.map(function (player) {
                    return {
                        name: player.name,
                        stats: player.stats
                    };
                })
            }, true);
            _destroyGame();
        }
    }
    /**
     * Returns the MissionDescriptor JSON data to be used to load the battle for
     * the currently set up multiplayer game.
     * @returns {Object}
     */
    function getMissionData() {
        var
                radius = 500,
                playerCount = _game.players.length,
                getAngle = function (index) {
                    return index / playerCount * Math.PI * 2;
                },
                playerIndex = _getPlayerIndex(),
                teams = _game.players.map(function (player, index) {
                    return {
                        name: "Team " + (index + 1),
                        color: player.settings.color.concat(1)
                    };
                }),
                spacecrafts = _game.players.map(function (player, index) {
                    var angle = getAngle(index);
                    return {
                        name: player.name,
                        team: "Team " + (index + 1),
                        class: "falcon",
                        piloted: index === playerIndex,
                        multi: !(_isHost && (index === 0)),
                        position: [radius * Math.sin(angle), radius * -Math.cos(angle), 0],
                        rotations: ["z-" + Math.round(Math.degrees(angle))],
                        loadout: _game.settings.loadout
                    };
                });
        return {
            title: _game.name,
            environment: _game.settings.environment,
            teams: teams,
            spacecrafts: spacecrafts
        };

    }
    /**
     * Send a game update message to all the guests of the current game. (to be
     * used by the host of the game)
     * @param {Spacecraft[]} spacecrafts The spacecrafts to get the update data
     * from
     */
    function sendHostUpdate(spacecrafts) {
        var i, data = new Float32Array(spacecrafts.length * SPACECRAFT_HOST_DATA_LENGTH), socketNeeded = false;
        for (i = 0; i < spacecrafts.length; i++) {
            data.set(spacecrafts[i].getMultiHostData(), i * SPACECRAFT_HOST_DATA_LENGTH);
        }
        for (i = 1; i < _game.players.length; i++) {
            if (_playerIsPeer(_game.players[i])) {
                _game.players[i].updateChannel.send(data);
            } else {
                socketNeeded = true;
            }
        }
        if (socketNeeded) {
            _socket.send(data);
        }
    }
    /**
     * Send a control message to the host of the current game if needed (to be 
     * used by the guests of the game). The message will be sent if either the
     * control state has changed since the last update or a specified repeat
     * interval time has elapsed (to synchronize the control state eventually
     * even if some messages get lost)
     * @param {Spacecraft} spacecraft The spacecraft controlled by the guest
     */
    function sendGuestUpdate(spacecraft) {
        var now = performance.now(), i, data = spacecraft.getMultiGuestData();
        if (now - _lastGuestUpdateTime > GUEST_REPEAT_INTERVAL) {
            _sendGuestUpdate(now, data);
            return;
        }
        for (i = 0; i < GUEST_DATA_LENGTH; i++) {
            if (data[i] !== _lastGuestUpdate[i]) {
                _sendGuestUpdate(now, data);
                return;
            }
        }
    }
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ERROR_CODE_GAME_NOT_FOUND: ERROR_CODE_GAME_NOT_FOUND,
        ERROR_CODE_GAME_IS_FULL: ERROR_CODE_GAME_IS_FULL,
        ERROR_CODE_GAME_ALREADY_STARTED: ERROR_CODE_GAME_ALREADY_STARTED,
        ERROR_CODE_PLAYER_NAME_ALREADY_EXISTS: ERROR_CODE_PLAYER_NAME_ALREADY_EXISTS,
        ERROR_CODE_GAME_NAME_ALREADY_EXISTS: ERROR_CODE_GAME_NAME_ALREADY_EXISTS,
        ERROR_CODE_INVALID_GAME_SETTINGS: ERROR_CODE_INVALID_GAME_SETTINGS,
        init: init,
        isConnected: isConnected,
        connect: connect,
        disconnect: disconnect,
        getServerPing: getServerPing,
        getPlayerName: getPlayerName,
        setPlayerName: setPlayerName,
        getPlayerSettings: getPlayerSettings,
        updatePlayerSettings: updatePlayerSettings,
        isInGame: isInGame,
        isHost: isHost,
        getGameName: getGameName,
        getGameSettings: getGameSettings,
        getHostName: getHostName,
        listGames: listGames,
        createGame: createGame,
        updateGameSettings: updateGameSettings,
        joinGame: joinGame,
        onConnect: onConnect,
        onDisconnect: onDisconnect,
        onError: onError,
        onPlayerJoin: onPlayerJoin,
        onPlayerLeave: onPlayerLeave,
        onPlayerReady: onPlayerReady,
        onPlayerKicked: onPlayerKicked,
        onPlayerUpdate: onPlayerUpdate,
        onGameSettingsChanged: onGameSettingsChanged,
        onKicked: onKicked,
        onText: onText,
        onHostLeft: onHostLeft,
        onGameStart: onGameStart,
        leaveGame: leaveGame,
        kickPlayer: kickPlayer,
        getPlayers: getPlayers,
        ping: ping,
        sendText: sendText,
        markReady: markReady,
        allPlayersReady: allPlayersReady,
        startGame: startGame,
        markLoaded: markLoaded,
        registerPlayerKill: registerPlayerKill,
        concludeMatch: concludeMatch,
        getMissionData: getMissionData,
        sendHostUpdate: sendHostUpdate,
        sendGuestUpdate: sendGuestUpdate,
        onGameUpdate: onGameUpdate,
        onMatchConcluded: onMatchConcluded
    };
});