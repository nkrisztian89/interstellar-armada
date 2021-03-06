/**
 * Copyright 2021 Krisztián Nagy
 * @file This module manages and provides the Multiplayer Lobby screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, setInterval, clearInterval */

/**
 * @param utils Used for string formatting
 * @param game Used for navigation
 * @param components Used for creating the InfoBox for the screen
 * @param screens The lobby screen is a subclass of HTMLScreen
 * @param audio Used for music management
 * @param networking Used for communicating with the other game clients and the 
 * game server
 * @param strings Used for translation
 * @param armadaScreens Used for navigation
 * @param environments Used to load the list of environments to select from
 */
define([
    "utils/utils",
    "modules/game",
    "modules/components",
    "modules/screens",
    "armada/audio",
    "armada/networking",
    "armada/strings",
    "armada/screens/shared",
    "armada/logic/environments"
], function (utils, game, components, screens, audio, networking, strings, armadaScreens, environments) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            GAME_TITLE_ID = "gameTitle",
            LEAVE_BUTTON_ID = "leaveButton",
            READY_BUTTON_ID = "readyButton",
            START_BUTTON_ID = "startButton",
            PLAYERS_LIST_ID = "playersList",
            CHAT_LOG_ID = "chatLog",
            CHAT_MESSAGE_ID = "chatMessage",
            CHAT_SEND_ID = "chatSend",
            INFO_BOX_ID = "infoBox",
            KICK_BUTTON_CLASS = "kickPlayer",
            HOST_SETTINGS_ID = "hostSettings",
            GUEST_SETTINGS_ID = "guestSettings",
            LOCATION_VALUE_ID = "locationValue",
            LOCATION_SELECTOR_ID = "locationSelector",
            PLAYER_COLORS = [
                [0.8, 0.2, 0.2],
                [0.2, 0.2, 0.8],
                [0.2, 0.8, 0.2],
                [0.8, 0.8, 0.2],
                [0.8, 0.2, 0.8],
                [0.1, 0.1, 0.1],
                [0.9, 0.9, 0.9]
            ];
    function _mapLocationName(environment) {
        return environments.getEnvironment(environment).getDisplayName();
    }
    function _getLocationValues() {
        return environments.getEnvironmentNames().map(_mapLocationName);
    }
    function _getCSSColor(color) {
        return "rgb(" + Math.round(color[0] * 255) + "," + Math.round(color[1] * 255) + "," + Math.round(color[2] * 255) + ")";
    }
    function _colorsEqual(a, b) {
        var epsilon = 0.05;
        return (Math.abs(a[0] - b[0]) < epsilon) && (Math.abs(a[1] - b[1]) < epsilon) && (Math.abs(a[2] - b[2]) < epsilon);
    }
    function _getNextAvailableColor(color) {
        var index, i, players = networking.getPlayers();
        for (index = 0; index < PLAYER_COLORS.length; index++) {
            if (_colorsEqual(color, PLAYER_COLORS[index])) {
                break;
            }
        }
        index = (index >= PLAYER_COLORS.length) ? 0 : ((index + 1) % PLAYER_COLORS.length);
        for (i = 0; i < players.length; i++) {
            if (!players[i].me && _colorsEqual(PLAYER_COLORS[index], players[i].settings.color)) {
                i = -1;
                index = (index + 1) % PLAYER_COLORS.length;
            }
        }
        return PLAYER_COLORS[index];
    }
    // #########################################################################
    /**
     * @class Provides the behaviour for the Multiplayer Lobby screen
     * @extends HTMLScreen
     */
    function MultiLobbyScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.MULTI_LOBBY_SCREEN_NAME,
                armadaScreens.MULTI_LOBBY_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.MULTI_LOBBY_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                {
                    show: function () {
                        audio.resetMasterVolume();
                        audio.resetMusicVolume();
                        audio.playMusic(armadaScreens.MENU_THEME);
                    }
                },
                {},
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /** @type SimpleComponent */
        this._gameTitle = this.registerSimpleComponent(GAME_TITLE_ID);
        /** @type SimpleComponent */
        this._leaveButton = this.registerSimpleComponent(LEAVE_BUTTON_ID);
        /** @type SimpleComponent */
        this._readyButton = this.registerSimpleComponent(READY_BUTTON_ID);
        /** @type SimpleComponent */
        this._startButton = this.registerSimpleComponent(START_BUTTON_ID);
        /** @type SimpleComponent */
        this._playersList = this.registerSimpleComponent(PLAYERS_LIST_ID);
        /** @type SimpleComponent */
        this._chatLog = this.registerSimpleComponent(CHAT_LOG_ID);
        /** @type SimpleComponent */
        this._chatMessage = this.registerSimpleComponent(CHAT_MESSAGE_ID);
        /** @type SimpleComponent */
        this._chatSend = this.registerSimpleComponent(CHAT_SEND_ID);
        /** @type SimpleComponent */
        this._hostSettings = this.registerSimpleComponent(HOST_SETTINGS_ID);
        /** @type SimpleComponent */
        this._guestSettings = this.registerSimpleComponent(GUEST_SETTINGS_ID);
        /** @type SimpleComponent */
        this._locationValue = this.registerSimpleComponent(LOCATION_VALUE_ID);
        /** @type Number */
        this._pingInterval = -1;
        /** @type Selector*/
        this._locationSelector = null;
        /**
         * @type InfoBox
         */
        this._infoBox = this.registerExternalComponent(new components.InfoBox(
                INFO_BOX_ID,
                armadaScreens.INFO_BOX_SOURCE,
                {cssFilename: armadaScreens.INFO_BOX_CSS},
                strings.INFO_BOX.HEADER.name,
                strings.INFO_BOX.OK_BUTTON.name,
                {
                    buttonselect: armadaScreens.playButtonSelectSound,
                    buttonclick: armadaScreens.playButtonClickSound
                }));
        environments.executeWhenReady(function () {
            this._locationSelector = this.registerExternalComponent(
                    new components.Selector(
                            LOCATION_SELECTOR_ID,
                            armadaScreens.SELECTOR_SOURCE,
                            {
                                cssFilename: armadaScreens.SELECTOR_CSS,
                                selectorClassName: "smallSelector",
                                propertyContainerClassName: "smallSelectorPropertyContainer"
                            },
                            {id: strings.MULTI_LOBBY.LOCATION_LABEL.name},
                            _getLocationValues()),
                    HOST_SETTINGS_ID);
        }.bind(this));

    }
    MultiLobbyScreen.prototype = new screens.HTMLScreen();
    MultiLobbyScreen.prototype.constructor = MultiLobbyScreen;
    /**
     * Shows the given message to the user in an information box.
     * @param {String} message
     * @param {Function} onButtonClick
     */
    MultiLobbyScreen.prototype._showMessage = function (message, onButtonClick) {
        this._infoBox.updateMessage(message);
        this._infoBox.onButtonClick(onButtonClick);
        this._infoBox.show();
    };
    /**
     * Stops sending ping messages to the other players
     */
    MultiLobbyScreen.prototype._cancelInterval = function () {
        if (this._pingInterval !== -1) {
            clearInterval(this._pingInterval);
            this._pingInterval = -1;
        }
    };
    /**
     * Adds the passed message to the messaging log box
     * @param {String} message
     * @param {String} sender
     */
    MultiLobbyScreen.prototype._logMessage = function (message, sender) {
        var element = document.createElement("p");
        element.innerHTML = sender ?
                '<span class="multi-message-sender">' + sender + ': </span>' + message :
                '<span class="multi-message-system">' + message + '</span>';
        this._chatLog.getElement().appendChild(element);
        element.scrollIntoView(false);
        element.style.background = "none";
    };
    /**
     * @override
     * @param {Boolean} active
     */
    MultiLobbyScreen.prototype.setActive = function (active) {
        screens.HTMLScreen.prototype.setActive.call(this, active);
        if (active) {
            this._gameTitle.setContent(strings.get(strings.MULTI_LOBBY.GAME_TITLE), {name: networking.getGameName()});
            this._updatePlayersList();
            networking.onDisconnect(function () {
                this._cancelInterval();
                this._showMessage(strings.get(strings.MULTI_GAMES.DISCONNECT_MESSAGE), function () {
                    game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
                }.bind(this));
            }.bind(this));
            networking.onGameSettingsChanged(function () {
                this._updateGameSettings();
            }.bind(this));
            networking.onPlayerJoin(function (playerName) {
                this._updatePlayersList();
                this._logMessage(utils.formatString(strings.get(strings.MULTI_LOBBY.PLAYER_JOINED_MESSAGE), {
                    name: playerName
                }));
            }.bind(this));
            networking.onPlayerLeave(function (player) {
                this._updatePlayersList();
                this._logMessage(utils.formatString(strings.get(strings.MULTI_LOBBY.PLAYER_LEFT_MESSAGE), {
                    name: player.name
                }));
            }.bind(this));
            networking.onPlayerReady(function (player) {
                this._updatePlayersList();
                this._logMessage(utils.formatString(strings.get(strings.MULTI_LOBBY.PLAYER_READY_MESSAGE), {
                    name: player.name
                }));
            }.bind(this));
            networking.onPlayerKicked(function (player) {
                this._updatePlayersList();
                this._logMessage(utils.formatString(strings.get(strings.MULTI_LOBBY.PLAYER_KICKED_MESSAGE), {
                    name: player.name
                }));
            }.bind(this));
            networking.onPlayerUpdate(function () {
                this._updatePlayersList();
            }.bind(this));
            networking.onText(function (message) {
                this._logMessage(message.text, message.sender);
            }.bind(this));
            networking.onHostLeft(function () {
                this._cancelInterval();
                this._showMessage(strings.get(strings.MULTI_LOBBY.HOST_LEFT_MESSAGE), function () {
                    game.closeOrNavigateTo(armadaScreens.MULTI_GAMES_SCREEN_NAME);
                }.bind(this));
            }.bind(this));
            networking.onKicked(function () {
                this._cancelInterval();
                this._showMessage(strings.get(strings.MULTI_LOBBY.KICKED_MESSAGE), function () {
                    game.closeOrNavigateTo(armadaScreens.MULTI_GAMES_SCREEN_NAME);
                }.bind(this));
            }.bind(this));
            networking.onGameStart(function () {
                game.setScreen(armadaScreens.BATTLE_SCREEN_NAME);
                game.getScreen().startNewBattle({
                    missionData: networking.getMissionData(),
                    difficulty: "hard",
                    demoMode: false,
                    multi: true
                });
            });
            this._readyButton.setVisible(!networking.isHost());
            this._readyButton.enable();
            this._startButton.setVisible(networking.isHost());
            this._startButton.disable();
            this._chatLog.setContent("");
            this._chatMessage.getElement().value = "";
            this._chatSend.disable();
            this._pingInterval = setInterval(networking.ping, 3000);
            this._updateGameSettings();
            this._hostSettings.setVisible(networking.isHost());
            this._guestSettings.setVisible(!networking.isHost());
        } else {
            this._cancelInterval();
        }
    };
    /**
     * Send the text message entered in the message input field to the other
     * players and clear the input field
     */
    MultiLobbyScreen.prototype._sendText = function () {
        var text = this._chatMessage.getElement().value;
        if (text) {
            networking.sendText(text);
            this._logMessage(text, networking.getPlayerName());
        }
        this._chatMessage.getElement().value = "";
        this._chatSend.disable();
    };
    /**
     * @override
     */
    MultiLobbyScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._leaveButton.getElement().onclick = function () {
            networking.leaveGame();
            game.closeOrNavigateTo(armadaScreens.MULTI_GAMES_SCREEN_NAME);
            return false;
        }.bind(this);
        this._readyButton.getElement().onclick = function () {
            networking.markReady();
            this._readyButton.disable();
            return false;
        }.bind(this);
        this._startButton.getElement().onclick = function () {
            networking.startGame();
            this._startButton.disable();
            return false;
        }.bind(this);
        this._chatSend.getElement().onclick = function () {
            this._sendText();
            return false;
        }.bind(this);
        this._chatMessage.getElement().onkeyup = function (event) {
            if (event.keyCode === 13) {
                this._sendText();
            } else {
                if (this._chatMessage.getElement().value) {
                    this._chatSend.enable();
                } else {
                    this._chatSend.disable();
                }
            }
        }.bind(this);
        this._locationSelector.onChange = function () {
            networking.updateGameSettings({
                environment: environments.getEnvironmentNames()[this._locationSelector.getSelectedIndex()]
            });
        }.bind(this);
    };
    /**
     * @override
     */
    MultiLobbyScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._locationSelector.setValueList(_getLocationValues());
    };
    /**
     * Update the player list display with the current player information
     */
    MultiLobbyScreen.prototype._updatePlayersList = function () {
        var i, button, players = networking.getPlayers(),
                colorSelectorId = "player-color-selector",
                colorSelectorAction = function () {
                    var color = _getNextAvailableColor(networking.getPlayerSettings().color);
                    networking.updatePlayerSettings({
                        color: color
                    });
                    this._updatePlayersList();
                },
                getKickButtonId = function (index) {
                    return "kick-player-" + index;
                },
                kickButtonAction = function (index) {
                    networking.kickPlayer(players[index].name);
                };
        this._playersList.setContent(players.map(function (player, index) {
            return `<tr><td>${player.name}</td>` +
                    `<td><div ${player.me ? 'id="' + colorSelectorId + '"' : ''} class="colorIndicator${(player.me && !player.ready) ? ' colorSelector' : ''}" style="background-color: ${_getCSSColor(player.settings.color)}"></div></td>` +
                    `<td>${player.me ? "" : strings.get(player.peer ? strings.MULTI_LOBBY.CONNECTION_DIRECT : strings.MULTI_LOBBY.CONNECTION_SERVER)}</td>` +
                    `<td>${player.me ? "" : (player.ping ? Math.round(player.ping) + " ms" : "?")}</td>` +
                    `<td>${(index === 0) ? "" : strings.get(player.ready ? strings.MULTI_LOBBY.READY_YES : strings.MULTI_LOBBY.READY_NO)}</td>` +
                    `<td>${networking.isHost() && !player.me ? '<button id="' + getKickButtonId(index) + '" class="' + KICK_BUTTON_CLASS + '">' + strings.get(strings.MULTI_LOBBY.KICK_BUTTON) + '</button>' : ""}</td>` +
                    `</tr>`;
        }).join(""));
        document.getElementById(colorSelectorId).onclick = colorSelectorAction.bind(this);
        if (networking.isHost()) {
            for (i = 1; i < players.length; i++) {
                button = document.getElementById(getKickButtonId(i));
                button.onclick = kickButtonAction.bind(this, i);
            }
            if (networking.allPlayersReady()) {
                this._startButton.enable();
            } else {
                this._startButton.disable();
            }
        }
    };
    /**
     * Update the game settings display with the values from the current general
     * game settings
     */
    MultiLobbyScreen.prototype._updateGameSettings = function () {
        var settings = networking.getGameSettings(), location;
        location = environments.getEnvironment(settings.environment).getDisplayName();
        this._locationValue.setContent(location);
        this._locationSelector.selectValue(location);
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getMultiLobbyScreen: function () {
            return new MultiLobbyScreen();
        }
    };
});