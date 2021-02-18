/**
 * Copyright 2021 Krisztián Nagy
 * @file This module manages and provides the Multiplayer Games screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, setInterval, clearInterval */

/**
 * @param game Used for navigation
 * @param screens The multiplayer games screen is a subclass of HTMLScreen
 * @param components Used for creating the InfoBox for the screen
 * @param audio Used for music management
 * @param networking Used for communicating with the game server to query the
 * list of multiplayer games and host or join them
 * @param strings Used for translation
 * @param armadaScreens Used for navigation
 */
define([
    "modules/game",
    "modules/screens",
    "modules/components",
    "armada/audio",
    "armada/networking",
    "armada/strings",
    "armada/screens/shared"
], function (game, screens, components, audio, networking, strings, armadaScreens) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            INFO_BOX_ID = "infoBox",
            BACK_BUTTON_ID = "backButton",
            REFRESH_BUTTON_ID = "refreshButton",
            CREATE_GAME_BUTTON_ID = "createGameButton",
            SERVER_INFO_CONTAINER_ID = "serverInfoContainer",
            CONNECTING_LABEL_ID = "connectingLabel",
            NO_AVILABLE_GAMES_ID = "noAvailableGamesLabel",
            ONLINE_PLAYERS_VALUE_ID = "onlinePlayersValue",
            SERVER_PING_VALUE_ID = "serverPingValue",
            GAMES_TABLE_ID = "gamesTable",
            GAMES_LIST_ID = "gamesList",
            PLAYER_POPUP_BACKGROUND_ID = "playerPopupBackground",
            PLAYER_NAME_INPUT_ID = "playerNameInput",
            PLAYER_OK_BUTTON_ID = "playerOkButton",
            PLAYER_CANCEL_BUTTON_ID = "playerCancelButton",
            CREATE_GAME_POPUP_BACKGROUND_ID = "createGamePopupBackground",
            CREATE_GAME_CREATE_BUTTON_ID = "createGameCreateButton",
            CREATE_GAME_CANCEL_BUTTON_ID = "createGameCancelButton",
            CREATE_GAME_NAME_ID = "createGameName",
            GAMES_REFRESH_INTERVAL = 5000,
            MIN_PLAYER_NAME_LENGTH = 2,
            MAX_PLAYER_NAME_LENGTH = 18,
            MIN_GAME_NAME_LENGTH = 3,
            MAX_GAME_NAME_LENGTH = 18;
    // ------------------------------------------------------------------------------
    // private variables
    // #########################################################################
    /**
     * @class Provides the behaviour for the Multiplayer Games screen
     * @extends HTMLScreen
     */
    function MultiGamesScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.MULTI_GAMES_SCREEN_NAME,
                armadaScreens.MULTI_GAMES_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.MULTI_GAMES_SCREEN_CSS,
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
                this._getKeyCommands(),
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /** @type SimpleComponent */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /** @type SimpleComponent */
        this._refreshButton = this.registerSimpleComponent(REFRESH_BUTTON_ID);
        /** @type SimpleComponent */
        this._createGameButton = this.registerSimpleComponent(CREATE_GAME_BUTTON_ID);
        /** @type SimpleComponent */
        this._serverInfoContainer = this.registerSimpleComponent(SERVER_INFO_CONTAINER_ID);
        /** @type SimpleComponent */
        this._connectingLabel = this.registerSimpleComponent(CONNECTING_LABEL_ID);
        /** @type SimpleComponent */
        this._noAvailableGamesLabel = this.registerSimpleComponent(NO_AVILABLE_GAMES_ID);
        /** @type SimpleComponent */
        this._onlinePlayersValue = this.registerSimpleComponent(ONLINE_PLAYERS_VALUE_ID);
        /** @type SimpleComponent */
        this._serverPingValue = this.registerSimpleComponent(SERVER_PING_VALUE_ID);
        /** @type SimpleComponent */
        this._gamesTable = this.registerSimpleComponent(GAMES_TABLE_ID);
        /** @type SimpleComponent */
        this._gamesList = this.registerSimpleComponent(GAMES_LIST_ID);
        /** @type SimpleComponent */
        this._createGamePopupBackground = this.registerSimpleComponent(CREATE_GAME_POPUP_BACKGROUND_ID);
        /** @type SimpleComponent */
        this._createGameCreateButton = this.registerSimpleComponent(CREATE_GAME_CREATE_BUTTON_ID);
        /** @type SimpleComponent */
        this._createGameCancelButton = this.registerSimpleComponent(CREATE_GAME_CANCEL_BUTTON_ID);
        /** @type SimpleComponent */
        this._createGameNameInput = this.registerSimpleComponent(CREATE_GAME_NAME_ID);
        /** @type SimpleComponent */
        this._playerPopupBackground = this.registerSimpleComponent(PLAYER_POPUP_BACKGROUND_ID);
        /** @type SimpleComponent */
        this._playerOkButton = this.registerSimpleComponent(PLAYER_OK_BUTTON_ID);
        /** @type SimpleComponent */
        this._playerCancelButton = this.registerSimpleComponent(PLAYER_CANCEL_BUTTON_ID);
        /** @type SimpleComponent */
        this._playerNameInput = this.registerSimpleComponent(PLAYER_NAME_INPUT_ID);
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
        /** @type Number */
        this._interval = -1;
    }
    MultiGamesScreen.prototype = new screens.HTMLScreen();
    MultiGamesScreen.prototype.constructor = MultiGamesScreen;
    /**
     * Adds the screen key commands to the given key commands object and returns the result.
     * @param {Object.<String, Function>} [keyCommands] If not given, an object with just the screen key commands
     * will be returned.
     */
    MultiGamesScreen.prototype._getKeyCommands = function (keyCommands) {
        keyCommands = keyCommands || {};
        keyCommands.escape = function () {
            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
        };
        return keyCommands;
    };
    /**
     * Shows the given message to the user in an information box.
     * @param {String} message
     * @param {Function} onButtonClick
     */
    MultiGamesScreen.prototype._showMessage = function (message, onButtonClick) {
        this._infoBox.updateMessage(message);
        this._infoBox.onButtonClick(onButtonClick);
        this._infoBox.show();
    };
    /**
     * Stops periodically querying the game list from the server
     */
    MultiGamesScreen.prototype._cancelInterval = function () {
        if (this._interval !== -1) {
            clearInterval(this._interval);
            this._interval = -1;
        }
    };
    /**
     * Enables / disables the Ok button on the player name prompt popup
     * according to the currently entered player name
     */
    MultiGamesScreen.prototype._updatePlayerOkButton = function () {
        if (this._playerNameInput.getElement().value.length >= MIN_PLAYER_NAME_LENGTH) {
            this._playerOkButton.enable();
        } else {
            this._playerOkButton.disable();
        }
    };
    /**
     * Enables / disables the Create button on the create game popup according
     * to the currently entered game name
     */
    MultiGamesScreen.prototype._updatecreateGameCreateButton = function () {
        if (this._createGameNameInput.getElement().value.length >= MIN_GAME_NAME_LENGTH) {
            this._createGameCreateButton.enable();
        } else {
            this._createGameCreateButton.disable();
        }
    };
    /**
     * Disconnects from the multiplayer server and other players and stops
     * sending any messages, returns to the main menu.
     */
    MultiGamesScreen.prototype._quitMultiplayer = function () {
        this._cancelInterval();
        networking.onConnect(null);
        networking.onDisconnect(null);
        networking.disconnect();
        game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
    };
    /**
     * @override
     * @param {Boolean} active
     */
    MultiGamesScreen.prototype.setActive = function (active) {
        var refresh = networking.listGames.bind(this, this._updateGamesList.bind(this));
        screens.HTMLScreen.prototype.setActive.call(this, active);
        if (active) {
            if (!networking.isConnected()) {
                this._refreshButton.disable();
                this._createGameButton.disable();
                this._serverInfoContainer.hide();
                this._connectingLabel.show();
                networking.onConnect(function () {
                    this._interval = setInterval(refresh, GAMES_REFRESH_INTERVAL);
                    refresh();
                    this._createGameButton.enable();
                    this._connectingLabel.hide();
                    this._serverInfoContainer.show();
                }.bind(this));
                networking.connect();
            } else {
                this._interval = setInterval(refresh, GAMES_REFRESH_INTERVAL);
                refresh();
            }
            networking.onDisconnect(function (wasConnected) {
                this._cancelInterval();
                this._createGamePopupBackground.hide();
                this._playerPopupBackground.hide();
                this._showMessage(
                        strings.get(wasConnected ?
                                strings.MULTI_GAMES.DISCONNECT_MESSAGE :
                                strings.MULTI_GAMES.CANNOT_CONNECT_MESSAGE),
                        function () {
                            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
                        }.bind(this));
            }.bind(this));
            networking.onError(function (errorCode) {
                var message, callback;
                switch (errorCode) {
                    case networking.ERROR_CODE_GAME_NOT_FOUND:
                        message = strings.MULTI_GAMES.GAME_NOT_FOUND_ERROR;
                        break;
                    case networking.ERROR_CODE_GAME_IS_FULL:
                        message = strings.MULTI_GAMES.GAME_IS_FULL_ERROR;
                        break;
                    case networking.ERROR_CODE_GAME_ALREADY_STARTED:
                        message = strings.MULTI_GAMES.GAME_ALREADY_STARTED_ERROR;
                        break;
                    case networking.ERROR_CODE_PLAYER_NAME_ALREADY_EXISTS:
                        message = strings.MULTI_GAMES.PLAYER_NAME_ALREADY_EXISTS_ERROR;
                        callback = function () {
                            this._playerPopupBackground.show();
                        }.bind(this);
                        break;
                    case networking.ERROR_CODE_GAME_NAME_ALREADY_EXISTS:
                        message = strings.MULTI_GAMES.GAME_NAME_ALREADY_EXISTS_ERROR;
                        break;
                    case networking.ERROR_CODE_INVALID_GAME_SETTINGS:
                        message = strings.MULTI_GAMES.INVALID_GAME_SETTINGS_ERROR;
                        break;
                }
                this._showMessage(strings.get(message), callback);
            }.bind(this));
            this._createGamePopupBackground.hide();
            if (!networking.getPlayerName()) {
                this._playerPopupBackground.show();
                this._playerNameInput.getElement().focus();
            }
            this._updatePlayerOkButton();
            this._createGameCreateButton.disable();
        } else {
            this._cancelInterval();
            networking.onError(null);
        }
    };
    /**
     * @override
     */
    MultiGamesScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            this._quitMultiplayer();
            return false;
        }.bind(this);
        this._refreshButton.getElement().onclick = function () {
            networking.listGames(this._updateGamesList.bind(this));
            return false;
        }.bind(this);
        this._createGameButton.getElement().onclick = function () {
            this._createGamePopupBackground.show();
            this._updatecreateGameCreateButton();
            this._createGameNameInput.getElement().focus();
            return false;
        }.bind(this);
        this._createGameCancelButton.getElement().onclick = function () {
            this._createGamePopupBackground.hide();
            return false;
        }.bind(this);
        this._createGameNameInput.getElement().maxLength = MAX_GAME_NAME_LENGTH;
        this._createGameNameInput.getElement().onkeyup = function () {
            this._updatecreateGameCreateButton();
            return false;
        }.bind(this);
        this._createGameCreateButton.getElement().onclick = function () {
            networking.createGame({
                gameName: this._createGameNameInput.getElement().value,
                maxPlayers: 2
            }, function () {
                game.closeOrNavigateTo(armadaScreens.MULTI_LOBBY_SCREEN_NAME);
            });
            return false;
        }.bind(this);
        this._playerCancelButton.getElement().onclick = function () {
            this._quitMultiplayer();
            return false;
        }.bind(this);
        this._playerNameInput.getElement().maxLength = MAX_PLAYER_NAME_LENGTH;
        this._playerNameInput.getElement().onkeyup = function () {
            this._updatePlayerOkButton();
        }.bind(this);
        this._playerOkButton.getElement().onclick = function () {
            networking.setPlayerName(this._playerNameInput.getElement().value);
            this._playerPopupBackground.hide();
            return false;
        }.bind(this);
        this._createGamePopupBackground.hide();
    };
    /**
     * Updates the game list display according to the passed data (the "games"
     * field should contain the array of Game models)
     * @param {Object} data
     */
    MultiGamesScreen.prototype._updateGamesList = function (data) {
        var i, button, games = data.games,
                getJoinButtonId = function (index) {
                    return "join-game-" + index;
                },
                joinButtonAction = function (index) {
                    networking.joinGame({
                        gameName: games[index].name
                    }, function () {
                        game.closeOrNavigateTo(armadaScreens.MULTI_LOBBY_SCREEN_NAME);
                    });
                };
        this._onlinePlayersValue.setContent(data.players);
        this._serverPingValue.setContent(Math.round(networking.getServerPing()) + " ms");
        if (games.length > 0) {
            this._gamesList.setContent(games.map(function (game, index) {
                return `<tr><td>${game.name}</td>` +
                        `<td>${game.host}</td>` +
                        `<td>${game.players}/${game.maxPlayers}</td>` +
                        `<td>${strings.get(game.started ? strings.MULTI_GAMES.STARTED_YES : strings.MULTI_GAMES.STARTED_NO)}</td>` +
                        `<td>${((game.players < game.maxPlayers) && !game.started) ?
                        '<button id="' + getJoinButtonId(index) + '">' + strings.get(strings.MULTI_GAMES.JOIN_BUTTON) + '</button>' :
                        ""}</td>` +
                        `</tr>`;
            }).join(""));
            for (i = 0; i < games.length; i++) {
                button = document.getElementById(getJoinButtonId(i));
                button.onclick = joinButtonAction.bind(this, i);
            }
            this._gamesTable.show();
            this._noAvailableGamesLabel.hide();
        } else {
            this._gamesTable.hide();
            this._noAvailableGamesLabel.show();
        }
        this._refreshButton.enable();
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getMultiGamesScreen: function () {
            return new MultiGamesScreen();
        }
    };
});