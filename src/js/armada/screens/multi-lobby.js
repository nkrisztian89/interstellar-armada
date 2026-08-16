/**
 * Copyright 2021-2026 Krisztián Nagy
 * @file This module manages and provides the Multiplayer Lobby screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for string formatting
 * @param game Used for navigation
 * @param analytics Used for registering actions for analytics
 * @param components Used for creating the InfoBox for the screen
 * @param screens The lobby screen is a subclass of HTMLScreen
 * @param config Used for loading multiplayer configuration
 * @param audio Used for music management
 * @param networking Used for communicating with the other game clients and the 
 * game server
 * @param strings Used for translation
 * @param armadaScreens Used for navigation
 * @param missionsScreen Used for getting translated difficulty names
 * @param classes Used to get the name of the spacecraft classes to display
 * @param environments Used to load the list of environments to select from
 * @param missions Used to get the list of difficulty ids
 */
define([
    "utils/utils",
    "modules/game",
    "modules/analytics",
    "modules/components",
    "modules/screens",
    "armada/configuration",
    "armada/audio",
    "armada/networking",
    "armada/strings",
    "armada/screens/shared",
    "armada/screens/missions",
    "armada/logic/classes",
    "armada/logic/environments",
    "armada/logic/missions"
], function (utils, game, analytics, components, screens, config, audio, networking, strings, armadaScreens, missionsScreen, classes, environments, missions) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            GAME_NAME_VALUE_ID = "gameNameValue",
            GAME_MODE_VALUE_ID = "gameModeValue",
            LEAVE_BUTTON_ID = "leaveButton",
            READY_BUTTON_ID = "readyButton",
            START_BUTTON_ID = "startButton",
            PLAYERS_LIST_ID = "playersList",
            KICK_COLUMN_ID = "kickColumn",
            CHAT_LOG_ID = "chatLog",
            CHAT_MESSAGE_ID = "chatMessage",
            REMAINING_MESSAGE_CHARS_ID = "remainingMessageChars",
            CHAT_SEND_ID = "chatSend",
            MESSAGE_TIME_CLASS = "multi-message-time",
            MESSAGE_SENDER_CLASS = "multi-message-sender",
            MESSAGE_SYSTEM_CLASS = "multi-message-system",
            MESSAGE_CLASS = "multi-message",
            MAX_MESSAGE_LENGTH = 50,
            INFO_BOX_ID = "infoBox",
            OPEN_SLOT_CLASS = "openSlot fadedText",
            LOCAL_PLAYER_ROW_CLASS = "myPlayerRow",
            COLOR_COLUMN_CLASS = "colorColumn",
            COLOR_INDICATOR_CLASS = "colorIndicator",
            COLOR_SELECTOR_CLASS = "colorSelector",
            SPACECRAFT_CELL_CLASS = "spacecraftCell",
            SPACECRAFT_SELECTOR_ID_PREFIX = "spacecraftSelector",
            ACTIONS_COLUMN_CLASS = "actionsColumn",
            KICK_BUTTON_CLASS = "kickPlayer",
            HOST_SETTINGS_ID = "hostSettings",
            GUEST_SETTINGS_ID = "guestSettings",
            LOCATION_VALUE_ID = "locationValue",
            LOADOUT_VALUE_ID = "loadoutValue",
            DIFFICULTY_VALUE_ID = "difficultyValue",
            DIFFICULTY_CONTAINER_ID = "difficultyContainer",
            ENEMIES_PER_WAVE_VALUE_ID = "enemiesPerWaveValue",
            ENEMIES_PER_WAVE_CONTAINER_ID = "enemiesPerWaveContainer",
            LOCATION_SELECTOR_ID = "locationSelector",
            LOADOUT_SELECTOR_ID = "loadoutSelector",
            DIFFICULTY_SELECTOR_ID = "difficultySelector",
            ENEMIES_PER_WAVE_SELECTOR_ID = "enemiesPerWaveSelector",
            SMALL_NARROW_MULTI_BAR_SELECTOR_CLASS_NAME = "smallMultiBarSelector narrow",
            PLAYER_COLORS = [
                [0.8, 0.2, 0.2],
                [0.2, 0.2, 0.8],
                [0.2, 0.8, 0.2],
                [0.8, 0.8, 0.2],
                [0.8, 0.2, 0.8],
                [0.1, 0.1, 0.1],
                [0.9, 0.9, 0.9]
            ],
            ENEMIES_PER_WAVE_OPTIONS = [3, 5, 7, 9];
    // ------------------------------------------------------------------------------
    // private functions
    function _canChangePlayerColor() {
        return networking.isHost() || (networking.getGameMode() === networking.GameMode.FFA);
    }
    function _mapLocationName(environment) {
        return environments.getEnvironment(environment).getDisplayName();
    }
    function _getLocationValues() {
        return environments.getEnvironmentNames().map(_mapLocationName);
    }
    function _mapLoadoutName(loadout) {
        return strings.get(strings.MULTI_LOBBY.LOADOUT_PREFIX, loadout, loadout);
    }
    function _getLoadoutValues() {
        return config.getSetting(config.MULTI_SETTINGS.LOADOUTS).map(_mapLoadoutName);
    }
    function _getCSSColor(color) {
        return "rgb(" + Math.round(color[0] * 255) + "," + Math.round(color[1] * 255) + "," + Math.round(color[2] * 255) + ")";
    }
    function _getPlayerColor(player) {
        return _getCSSColor((networking.getGameMode() === networking.GameMode.FFA) ? player.settings.color : networking.getPlayers()[0].settings.color);
    }
    function _colorsEqual(a, b) {
        var epsilon = 0.05;
        return (Math.abs(a[0] - b[0]) < epsilon) && (Math.abs(a[1] - b[1]) < epsilon) && (Math.abs(a[2] - b[2]) < epsilon);
    }
    function _getNextAvailableColor(color) {
        var index, i, players = networking.getPlayers();
        if (networking.getGameMode() === networking.GameMode.FFA) {
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
        } else {
            index = PLAYER_COLORS.findIndex(function (color) {
                return _colorsEqual(color, players[0].settings.color);
            });
            return PLAYER_COLORS[(index + 1) % PLAYER_COLORS.length];
        }
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
        this._gameNameValue = this.registerSimpleComponent(GAME_NAME_VALUE_ID);
        /** @type SimpleComponent */
        this._gameModeValue = this.registerSimpleComponent(GAME_MODE_VALUE_ID);
        /** @type SimpleComponent */
        this._leaveButton = this.registerSimpleComponent(LEAVE_BUTTON_ID);
        /** @type SimpleComponent */
        this._readyButton = this.registerSimpleComponent(READY_BUTTON_ID);
        /** @type SimpleComponent */
        this._startButton = this.registerSimpleComponent(START_BUTTON_ID);
        /** @type SimpleComponent */
        this._playersList = this.registerSimpleComponent(PLAYERS_LIST_ID);
        /** @type SimpleComponent */
        this._kickColumn = this.registerSimpleComponent(KICK_COLUMN_ID);
        /** @type SimpleComponent */
        this._chatLog = this.registerSimpleComponent(CHAT_LOG_ID);
        /** @type SimpleComponent */
        this._chatMessage = this.registerSimpleComponent(CHAT_MESSAGE_ID);
        /** @type SimpleComponent */
        this._remainingMessageChars = this.registerSimpleComponent(REMAINING_MESSAGE_CHARS_ID);
        /** @type SimpleComponent */
        this._chatSend = this.registerSimpleComponent(CHAT_SEND_ID);
        /** @type SimpleComponent */
        this._hostSettings = this.registerSimpleComponent(HOST_SETTINGS_ID);
        /** @type SimpleComponent */
        this._guestSettings = this.registerSimpleComponent(GUEST_SETTINGS_ID);
        /** @type SimpleComponent */
        this._locationValue = this.registerSimpleComponent(LOCATION_VALUE_ID);
        /** @type SimpleComponent */
        this._loadoutValue = this.registerSimpleComponent(LOADOUT_VALUE_ID);
        /** @type SimpleComponent */
        this._difficultyValue = this.registerSimpleComponent(DIFFICULTY_VALUE_ID);
        /** @type SimpleComponent */
        this._difficultyContainer = this.registerSimpleComponent(DIFFICULTY_CONTAINER_ID);
        /** @type SimpleComponent */
        this._enemiesPerWaveValue = this.registerSimpleComponent(ENEMIES_PER_WAVE_VALUE_ID);
        /** @type SimpleComponent */
        this._enemiesPerWaveContainer = this.registerSimpleComponent(ENEMIES_PER_WAVE_CONTAINER_ID);
        /** @type Number */
        this._pingInterval = -1;
        /**
         * One per player slot index, holding a reference to the <td> element belonging to that player
         * index in the players table. Lazily created and then reused across updates of the player list.
         * @type Element[]
         */
        this._playerRows = [];
        /**
         * One per player slot index, holding a reference to the MultiBarSelector used to select the spacecraft
         * of the player at that index. Lazily created and then reused across updates of the player list.
         * @type MultiBarSelector[]
         */
        this._spacecraftSelectors = [];
        /** @type MultiBarSelector*/
        this._locationSelector = null;
        /** @type MultiBarSelector*/
        this._loadoutSelector = null;
        /** @type MultiBarSelector*/
        this._difficultySelector = null;
        /** @type MultiBarSelector*/
        this._enemiesPerWaveSelector = null;
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
        config.executeWhenReady(function () {
            this._difficultySelector = this.registerExternalComponent(
                    new components.MultiBarSelector(
                            DIFFICULTY_SELECTOR_ID,
                            armadaScreens.MULTI_BAR_SELECTOR_SOURCE,
                            {
                                cssFilename: armadaScreens.MULTI_BAR_SELECTOR_CSS,
                                selectorClassName: SMALL_NARROW_MULTI_BAR_SELECTOR_CLASS_NAME,
                                propertyContainerClassName: "smallSelectorPropertyContainer"
                            },
                            {id: strings.MULTI_LOBBY.DIFFICULTY_LABEL.name},
                            missionsScreen.getDifficultyValues(),
                            false,
                            false,
                            true),
                    HOST_SETTINGS_ID);
            environments.executeWhenReady(function () {
                this._locationSelector = this.registerExternalComponent(
                        new components.MultiBarSelector(
                                LOCATION_SELECTOR_ID,
                                armadaScreens.MULTI_BAR_SELECTOR_SOURCE,
                                {
                                    cssFilename: armadaScreens.MULTI_BAR_SELECTOR_CSS,
                                    selectorClassName: SMALL_NARROW_MULTI_BAR_SELECTOR_CLASS_NAME,
                                    propertyContainerClassName: "smallSelectorPropertyContainer"
                                },
                                {id: strings.MULTI_LOBBY.LOCATION_LABEL.name},
                                _getLocationValues(),
                                false,
                                true),
                        HOST_SETTINGS_ID);
            }.bind(this));
            this._loadoutSelector = this.registerExternalComponent(
                    new components.MultiBarSelector(
                            LOADOUT_SELECTOR_ID,
                            armadaScreens.MULTI_BAR_SELECTOR_SOURCE,
                            {
                                cssFilename: armadaScreens.MULTI_BAR_SELECTOR_CSS,
                                selectorClassName: SMALL_NARROW_MULTI_BAR_SELECTOR_CLASS_NAME,
                                propertyContainerClassName: "smallSelectorPropertyContainer"
                            },
                            {id: strings.MULTI_LOBBY.LOADOUT_LABEL.name},
                            _getLoadoutValues(),
                            false,
                            true),
                    HOST_SETTINGS_ID);
            this._enemiesPerWaveSelector = this.registerExternalComponent(
                    new components.MultiBarSelector(
                            ENEMIES_PER_WAVE_SELECTOR_ID,
                            armadaScreens.MULTI_BAR_SELECTOR_SOURCE,
                            {
                                cssFilename: armadaScreens.MULTI_BAR_SELECTOR_CSS,
                                selectorClassName: SMALL_NARROW_MULTI_BAR_SELECTOR_CLASS_NAME,
                                propertyContainerClassName: "smallSelectorPropertyContainer"
                            },
                            {id: strings.MULTI_LOBBY.ENEMIES_PER_WAVE_LABEL.name},
                            ENEMIES_PER_WAVE_OPTIONS,
                            false),
                    HOST_SETTINGS_ID);
        }.bind(this));

    }
    MultiLobbyScreen.prototype = new screens.HTMLScreen();
    MultiLobbyScreen.prototype.constructor = MultiLobbyScreen;
    /**
     * Shows the given message to the user in an information box.
     * @param {String} message
     * @param {Function} [onButtonClick]
     */
    MultiLobbyScreen.prototype._showMessage = function (message, onButtonClick) {
        this._infoBox.updateMessage(message);
        this._infoBox.onButtonClick(function () {
            armadaScreens.playButtonClickSound();
            if (onButtonClick) {
                onButtonClick();
            }
        });
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
     * @param {String} [sender]
     */
    MultiLobbyScreen.prototype._logMessage = function (message, sender) {
        var element = document.createElement("p"), date = new Date(), span;
        element.innerHTML = '<span class="' + MESSAGE_TIME_CLASS + '">[' + utils.getPaddedStringForNumber(date.getHours(), 2) + ':' + utils.getPaddedStringForNumber(date.getMinutes(), 2) + '] </span>';
        if (sender) {
            span = document.createElement("span");
            span.textContent = sender + ": ";
            span.className = MESSAGE_SENDER_CLASS;
            element.appendChild(span);
        }
        span = document.createElement("span");
        span.textContent = message;
        span.className = sender ? MESSAGE_CLASS : MESSAGE_SYSTEM_CLASS;
        element.appendChild(span);
        this._chatLog.getElement().appendChild(element);
        element.scrollIntoView(false);
        element.style.background = "none";
    };
    /**
     * @override
     * @param {Boolean} active
     */
    MultiLobbyScreen.prototype.setActive = function (active) {
        var coop;
        screens.HTMLScreen.prototype.setActive.call(this, active);
        if (active) {
            this._gameNameValue.setTextContent(networking.getGameName());
            this._gameModeValue.setTextContent(strings.get(strings.MULTI_GAME_MODE.PREFIX, networking.getGameMode()));
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
                analytics.sendEvent(networking.isHost() ? "multistarthost" : "multistartguest");
                game.setScreen(armadaScreens.BATTLE_SCREEN_NAME);
                game.getScreen().startNewBattle({
                    missionData: networking.getMissionData(),
                    difficulty: networking.getGameSettings().difficulty,
                    demoMode: false,
                    multi: true
                });
            });
            networking.onError(function (errorCode) {
                var message;
                switch (errorCode) {
                    case networking.ERROR_CODE_INVALID_TEXT:
                        message = strings.MULTI_GAMES.INVALID_TEXT_ERROR;
                        break;
                }
                this._showMessage(strings.get(message));
            }.bind(this));
            this._readyButton.setVisible(!networking.isHost());
            this._readyButton.enable();
            this._startButton.setVisible(networking.isHost());
            this._startButton.disable();
            this._chatLog.setContent("");
            this._logMessage(networking.isHost() ?
                    utils.formatString(strings.get(strings.MULTI_LOBBY.GAME_CREATED_MESSAGE), {
                        name: networking.getGameName()
                    }) :
                    strings.get(strings.MULTI_LOBBY.JOINED_MESSAGE));
            this._chatMessage.getElement().value = "";
            this._chatMessage.getElement().placeholder = strings.get(strings.MULTI_LOBBY.CHAT_MESSAGE_PLACEHOLDER);
            this._chatSend.disable();
            this._pingInterval = setInterval(networking.ping, 3000);
            this._updateGameSettings();
            coop = networking.getGameMode() === networking.GameMode.COOP;
            this._difficultyContainer.setVisible(coop);
            this._difficultySelector.setVisible(coop);
            this._enemiesPerWaveContainer.setVisible(coop);
            this._enemiesPerWaveSelector.setVisible(coop);
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
        this._remainingMessageChars.getElement().textContent = MAX_MESSAGE_LENGTH;
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
            this._logMessage(strings.get(strings.MULTI_LOBBY.READY_MESSAGE));
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
        this._chatMessage.getElement().maxLength = MAX_MESSAGE_LENGTH;
        this._remainingMessageChars.getElement().textContent = MAX_MESSAGE_LENGTH;
        this._chatMessage.getElement().oninput = function () {
            var value = this._chatMessage.getElement().value;
            if (value) {
                this._remainingMessageChars.getElement().textContent = MAX_MESSAGE_LENGTH - value.length;
            } else {
                this._remainingMessageChars.getElement().textContent = MAX_MESSAGE_LENGTH;
            }
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
        this._loadoutSelector.onChange = function () {
            networking.updateGameSettings({
                loadout: config.getSetting(config.MULTI_SETTINGS.LOADOUTS)[this._loadoutSelector.getSelectedIndex()]
            });
        }.bind(this);
        this._difficultySelector.onChange = function () {
            networking.updateGameSettings({
                difficulty: missions.getDifficultyNames()[this._difficultySelector.getSelectedIndex()]
            });
        }.bind(this);
        this._enemiesPerWaveSelector.onChange = function () {
            networking.updateGameSettings({
                enemiesPerWave: this._enemiesPerWaveSelector.getSelectedValue()
            });
        }.bind(this);
    };
    /**
     * @override
     */
    MultiLobbyScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._locationSelector.setValueList(_getLocationValues());
        this._loadoutSelector.setValueList(_getLoadoutValues());
        this._difficultySelector.setValueList(missionsScreen.getDifficultyValues());
    };
    /**
     * Returns the MultiBarSelector for the spacecraft selector of the player at the given index within
     * the players table, creating (and appending it into the passed table cell) if this is the first
     * time it is needed.
     * @param {Number} playerIndex
     * @param {Element} tdElement The table cell to append the selector into, if it needs to be created
     * @returns {MultiBarSelector}
     */
    MultiLobbyScreen.prototype._getSpacecraftSelector = function (playerIndex, tdElement) {
        var selector = this._spacecraftSelectors[playerIndex];
        if (!selector) {
            selector = new components.MultiBarSelector(
                    SPACECRAFT_SELECTOR_ID_PREFIX + playerIndex,
                    armadaScreens.MULTI_BAR_SELECTOR_SOURCE,
                    {
                        cssFilename: armadaScreens.MULTI_BAR_SELECTOR_CSS,
                        selectorClassName: SMALL_NARROW_MULTI_BAR_SELECTOR_CLASS_NAME
                    },
                    {caption: ""},
                    [""],
                    false,
                    true);
            selector.setRootElementID(this._getElementID(selector.getName()));
            selector.onChange = function (stepping) {
                if (stepping) {
                    networking.updatePlayerSettings({
                        spacecraft: networking.getGameSettings().spacecrafts[selector.getSelectedIndex()]
                    });
                }
            };
            this._spacecraftSelectors[playerIndex] = selector;
            selector.executeWhenReady(function () {
                this.addExternalComponent(selector, tdElement);
            }.bind(this));
        }
        return selector;
    };
    /**
     * Returns the <tr> element of the players table for the given row (player slot) index, creating it
     * (with its full, fixed set of <td> cells, and the event handlers of its interactive elements,
     * which look up the player currently occupying this row by index at the time they fire) if this is
     * the first time it is needed
     * @param {Number} rowIndex
     * @returns {Element}
     */
    MultiLobbyScreen.prototype._getPlayerRow = function (rowIndex) {
        var tr = this._playerRows[rowIndex], colorIndicator, kickButton;
        if (!tr) {
            tr = document.createElement("tr");
            tr.innerHTML =
                    '<td></td>' +
                    '<td class="' + COLOR_COLUMN_CLASS + '"><div></div></td>' +
                    '<td class="' + SPACECRAFT_CELL_CLASS + '"><span></span></td>' +
                    '<td></td>' +
                    '<td></td>' +
                    '<td></td>' +
                    '<td class="' + ACTIONS_COLUMN_CLASS + '"><button class="' + KICK_BUTTON_CLASS + '">' + strings.get(strings.MULTI_LOBBY.KICK_BUTTON) + '</button></td>';
            colorIndicator = tr.getElementsByTagName("div")[0];
            colorIndicator.onclick = function () {
                var player = networking.getPlayers()[rowIndex];
                if (player && player.me && !player.ready && _canChangePlayerColor()) {
                    networking.updatePlayerSettings({color: _getNextAvailableColor(networking.getPlayerSettings().color)});
                    this._updatePlayersList();
                }
            }.bind(this);
            kickButton = tr.getElementsByTagName("button")[0];
            kickButton.onclick = function () {
                var player = networking.getPlayers()[rowIndex];
                if (player && !player.me && networking.isHost()) {
                    networking.kickPlayer(player.name);
                }
            }.bind(this);
            this._playersList.getElement().appendChild(tr);
            this._playerRows[rowIndex] = tr;
        }
        return tr;
    };
    /**
     * Update the player list display with the current player information
     */
    MultiLobbyScreen.prototype._updatePlayersList = function () {
        var
                i, rowCount, tr, tds, player, textElement, selector,
                players = networking.getPlayers(),
                maxPlayers = networking.getMaxPlayers(),
                spacecrafts = networking.getGameSettings().spacecrafts,
                columnCount = networking.isHost() ? 7 : 6;
        this._kickColumn.setVisible(networking.isHost());
        rowCount = Math.max(maxPlayers, this._playerRows.length);
        for (i = 0; i < rowCount; i++) {
            tr = this._getPlayerRow(i);
            if (i >= maxPlayers) {
                // a row left over from a previous game that allowed more players than this one
                tr.hidden = true;
                continue;
            }
            tr.hidden = false;
            tds = tr.getElementsByTagName("td");
            player = players[i];
            if (!player) {
                tr.className = "";
                tds[0].colSpan = columnCount;
                tds[0].className = OPEN_SLOT_CLASS;
                tds[0].textContent = strings.get(strings.MULTI_LOBBY.OPEN_SLOT);
                tds[1].hidden = true;
                tds[2].hidden = true;
                tds[3].hidden = true;
                tds[4].hidden = true;
                tds[5].hidden = true;
                tds[6].hidden = true;
                continue;
            }
            tr.className = player.me ? LOCAL_PLAYER_ROW_CLASS : "";
            tds[0].colSpan = 1;
            tds[0].className = "";
            tds[0].textContent = player.name;
            tds[1].hidden = false;
            tds[2].hidden = false;
            tds[3].hidden = false;
            tds[4].hidden = false;
            tds[5].hidden = false;
            tds[6].hidden = !networking.isHost();
            // color
            tds[1].getElementsByTagName("div")[0].className = COLOR_INDICATOR_CLASS + ((player.me && !player.ready && _canChangePlayerColor()) ? " " + COLOR_SELECTOR_CLASS : "");
            tds[1].getElementsByTagName("div")[0].style.backgroundColor = _getPlayerColor(player);
            // spacecraft
            textElement = tds[2].getElementsByTagName("span")[0];
            if (spacecrafts.length < 2) {
                if (this._spacecraftSelectors[i]) {
                    this._spacecraftSelectors[i].hide();
                }
                textElement.hidden = false;
                textElement.textContent = classes.getSpacecraftClass(player.settings.spacecraft).getDisplayName();
            } else {
                textElement.hidden = true;
                selector = this._getSpacecraftSelector(i, tds[2]);
                (function (selector, player) {
                    selector.executeWhenReady(function () {
                        selector.setValueList(spacecrafts.map(function (spacecraft) {
                            return classes.getSpacecraftClass(spacecraft).getDisplayName();
                        }));
                        selector.selectValueWithIndex(spacecrafts.indexOf(player.settings.spacecraft), 0);
                        selector.show();
                        if (player.me && !player.ready) {
                            selector.enable();
                        } else {
                            selector.disable();
                        }
                    });
                }(selector, player));
            }
            // connection
            tds[3].textContent = player.me ? "" : strings.get(player.peer ? strings.MULTI_LOBBY.CONNECTION_DIRECT : strings.MULTI_LOBBY.CONNECTION_SERVER);
            // ping
            tds[4].textContent = player.me ? "" : (player.ping ? Math.round(player.ping) + " ms" : "?");
            // ready
            tds[5].textContent = strings.get(((i === 0) || player.ready) ? strings.MULTI_LOBBY.READY_YES : strings.MULTI_LOBBY.READY_NO);
            // kick button (host-only column; hidden within it for the local player's own row)
            tds[6].getElementsByTagName("button")[0].hidden = player.me;
        }
        if (networking.isHost()) {
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
        var settings = networking.getGameSettings(), location, loadout, difficulty;
        location = _mapLocationName(settings.environment);
        loadout = _mapLoadoutName(settings.loadout);
        difficulty = missionsScreen.mapDifficultyName(settings.difficulty);
        this._locationValue.setTextContent(location);
        this._loadoutValue.setTextContent(loadout);
        this._difficultyValue.setTextContent(difficulty);
        this._enemiesPerWaveValue.setTextContent(settings.enemiesPerWave);
        this._locationSelector.selectValue(location);
        this._loadoutSelector.selectValue(loadout);
        this._difficultySelector.selectValue(difficulty);
        this._enemiesPerWaveSelector.selectValue(settings.enemiesPerWave);
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getMultiLobbyScreen: function () {
            return new MultiLobbyScreen();
        }
    };
});