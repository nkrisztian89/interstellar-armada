/**
 * Copyright 2021 Krisztián Nagy
 * @file This module manages and provides the multiplayer scoreboard screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for formatting time
 * @param game Used for navigation 
 * @param screens The debriefing screen is a subclass of HTMLScreen
 * @param config Used for accessing music fading config
 * @param strings Used for translation support
 * @param audio Used for setting music theme
 * @param networking Used to get player statistics
 * @param armadaScreens Used for navigation
 */
define([
    "utils/utils",
    "modules/game",
    "modules/screens",
    "armada/configuration",
    "armada/strings",
    "armada/audio",
    "armada/networking",
    "armada/screens/shared"
], function (utils, game, screens, config, strings, audio, networking, armadaScreens) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            TITLE_ID = "title",
            PLAYERS_LIST_ID = "playersList",
            RANK_CELL_CLASS = "playerRank",
            NUMBER_CELL_CLASS = "number",
            // ------------------------------------------------------------------------------
            // private functions
            /**
             * @param {Player} player
             * @returns {Number}
             */
            _getPlayerScore = function (player) {
                return player.stats.kills * 1000 - player.stats.deaths;
            };
    // ##############################################################################
    /**
     * @class A class to represent the Mission debriefing screen in the game. Describes the dynamic behaviour on that screen.
     * @extends HTMLScreen
     */
    function MultiScoreScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.MULTI_SCORE_SCREEN_NAME,
                armadaScreens.MULTI_SCORE_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.MULTI_SCORE_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                {
                    show: function () {
                        audio.resetMasterVolume();
                        audio.resetMusicVolume();
                        audio.playMusic(
                                armadaScreens.DEBRIEFING_VICTORY_THEME,
                                undefined,
                                config.getSetting(config.BATTLE_SETTINGS.DEBRIEFING_THEME_FADE_IN_DURATION));
                        this.updateData();
                    }.bind(this)
                },
                {
                    "escape": function () {
                        game.closeOrNavigateTo(armadaScreens.MULTI_GAMES_SCREEN_NAME);
                    }
                },
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /** @type SimpleComponent */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /** @type SimpleComponent */
        this._title = this.registerSimpleComponent(TITLE_ID);
        /** @type SimpleComponent */
        this._playersList = this.registerSimpleComponent(PLAYERS_LIST_ID);
    }
    MultiScoreScreen.prototype = new screens.HTMLScreen();
    MultiScoreScreen.prototype.constructor = MultiScoreScreen;
    /**
     * @override
     */
    MultiScoreScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.MULTI_GAMES_SCREEN_NAME);
            return false;
        }.bind(this);
    };
    /**
     * Update the screen with the current data from the networking module
     */
    MultiScoreScreen.prototype.updateData = function () {
        var rank, lastScore, players;
        if (!networking.isInGame()) {
            return;
        }
        players = networking.getPlayers().slice().sort(function (a, b) {
            return _getPlayerScore(b) - _getPlayerScore(a);
        });
        this._title.setTextContent(utils.formatString(strings.get(strings.MULTI_SCORE.TITLE), {
            gameName: networking.getGameName()
        }));
        rank = 1;
        lastScore = 0;
        this._playersList.setContent("");
        players.forEach(function (player, index) {
            var tr, td, score = _getPlayerScore(player);
            if (score < lastScore) {
                rank = index + 1;
            }
            lastScore = score;
            tr = document.createElement("tr");
            tr.className = (player.me ? "me" : (player.left ? "left" : ""));
            tr.innerHTML = '<td class="' + RANK_CELL_CLASS + '">' + rank + '</td>';
            td = document.createElement("td");
            td.textContent = player.name;
            tr.appendChild(td);
            td = document.createElement("td");
            td.textContent = player.stats.kills;
            td.className = NUMBER_CELL_CLASS;
            tr.appendChild(td);
            td = document.createElement("td");
            td.textContent = player.stats.deaths;
            td.className = NUMBER_CELL_CLASS;
            tr.appendChild(td);
            this._playersList.getElement().appendChild(tr);
        }.bind(this));
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getMultiScoreScreen: function () {
            return new MultiScoreScreen();
        }
    };
});