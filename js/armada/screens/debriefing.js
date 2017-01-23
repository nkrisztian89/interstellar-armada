/**
 * Copyright 2016-2017 Krisztián Nagy
 * @file This module manages and provides the Mission debriefing screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, window, document, setInterval, clearInterval */

/**
 * @param utils Used for formatting time
 * @param game Used for navigation 
 * @param screens The debriefing screen is a subclass of HTMLScreen
 * @param config Used for accessing music fading config
 * @param strings Used for translation support
 * @param audio Used for setting music theme
 * @param armadaScreens Used for navigation
 * @param missions Used to access MissionState enum
 */
define([
    "utils/utils",
    "modules/game",
    "modules/screens",
    "armada/configuration",
    "armada/strings",
    "armada/audio",
    "armada/screens/shared",
    "armada/logic/missions"
], function (utils, game, screens, config, strings, audio, armadaScreens, missions) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            TITLE_ID = "title",
            MEDAL_ID = "medal",
            MEDAL_IMAGE_SOURCE = "images/empire_{performance}_100.png",
            MEDAL_IMAGE_NO_SCORE = "white",
            SCORE_CONTAINER_ID = "scoreContainer",
            SCORE_SPAN_ID = "score",
            NEW_RECORD_ID = "newRecord",
            DESCRIPTION_PARAGRAPH_ID = "description",
            SCORE_BREAKDOWN_CONTAINER_ID = "scoreBreakdownContainer",
            // statistics cells
            TIME_CELL_ID = "timeCell",
            KILLS_CELL_ID = "killsCell",
            DAMAGE_CELL_ID = "damageCell",
            HIT_RATIO_CELL_ID = "hitRatioCell",
            HULL_INTEGRITY_CELL_ID = "hullIntegrityCell",
            TEAM_SURVIVAL_CELL_ID = "teamSurvivalCell",
            // score breakdown cells
            BASE_SCORE_CELL_ID = "baseScoreCell",
            HIT_RATIO_BONUS_CELL_ID = "hitRatioBonusCell",
            HULL_INTEGRITY_BONUS_CELL_ID = "hullIntegrityBonusCell",
            TEAM_SURVIVAL_BONUS_CELL_ID = "teamSurvivalBonusCell",
            // bottom buttons
            RESTART_BUTTON_ID = "restartButton",
            // ------------------------------------------------------------------------------
            // private variables
            _shouldPlayVictoryMusic;
    // ##############################################################################
    /**
     * @class A class to represent the Mission debriefing screen in the game. Describes the dynamic behaviour on that screen.
     * @extends HTMLScreen
     */
    function DebriefingScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.DEBRIEFING_SCREEN_NAME,
                armadaScreens.DEBRIEFING_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.DEBRIEFING_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                {
                    show: function () {
                        audio.resetMasterVolume();
                        audio.resetMusicVolume();
                        audio.playMusic(
                                _shouldPlayVictoryMusic ? armadaScreens.DEBRIEFING_VICTORY_THEME : armadaScreens.DEBRIEFING_DEFEAT_THEME,
                                undefined,
                                config.getSetting(config.BATTLE_SETTINGS.DEBRIEFING_THEME_FADE_IN_DURATION));
                    }
                },
                {
                    "escape": function () {
                        game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
                    }
                },
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /** @type SimpleComponent */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /** @type SimpleComponent */
        this._title = this.registerSimpleComponent(TITLE_ID);
        /** @type SimpleComponent */
        this._medal = this.registerSimpleComponent(MEDAL_ID);
        /** @type SimpleComponent */
        this._scoreContainer = this.registerSimpleComponent(SCORE_CONTAINER_ID);
        /** @type SimpleComponent */
        this._scoreSpan = this.registerSimpleComponent(SCORE_SPAN_ID);
        /** @type SimpleComponent */
        this._newRecord = this.registerSimpleComponent(NEW_RECORD_ID);
        /** @type SimpleComponent */
        this._descriptionParagraph = this.registerSimpleComponent(DESCRIPTION_PARAGRAPH_ID);
        /** @type SimpleComponent */
        this._scoreBreakdownContainer = this.registerSimpleComponent(SCORE_BREAKDOWN_CONTAINER_ID);
        /** @type SimpleComponent */
        this._timeCell = this.registerSimpleComponent(TIME_CELL_ID);
        /** @type SimpleComponent */
        this._killsCell = this.registerSimpleComponent(KILLS_CELL_ID);
        /** @type SimpleComponent */
        this._damageCell = this.registerSimpleComponent(DAMAGE_CELL_ID);
        /** @type SimpleComponent */
        this._hitRatioCell = this.registerSimpleComponent(HIT_RATIO_CELL_ID);
        /** @type SimpleComponent */
        this._hullIntegrityCell = this.registerSimpleComponent(HULL_INTEGRITY_CELL_ID);
        /** @type SimpleComponent */
        this._teamSurvivalCell = this.registerSimpleComponent(TEAM_SURVIVAL_CELL_ID);
        /** @type SimpleComponent */
        this._baseScoreCell = this.registerSimpleComponent(BASE_SCORE_CELL_ID);
        /** @type SimpleComponent */
        this._hitRatioBonusCell = this.registerSimpleComponent(HIT_RATIO_BONUS_CELL_ID);
        /** @type SimpleComponent */
        this._hullIntegrityBonusCell = this.registerSimpleComponent(HULL_INTEGRITY_BONUS_CELL_ID);
        /** @type SimpleComponent */
        this._teamSurvivalBonusCell = this.registerSimpleComponent(TEAM_SURVIVAL_BONUS_CELL_ID);
        /** @type SimpleComponent */
        this._restartButton = this.registerSimpleComponent(RESTART_BUTTON_ID);
    }
    DebriefingScreen.prototype = new screens.HTMLScreen();
    DebriefingScreen.prototype.constructor = DebriefingScreen;
    /**
     * @override
     */
    DebriefingScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.MISSIONS_SCREEN_NAME);
            return false;
        }.bind(this);
        this._restartButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.BATTLE_SCREEN_NAME);
            game.getScreen().startNewBattle({
                restart: true
            });
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    DebriefingScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        //this._versionParagraph.customizeContent({version: game.getVersion()});
    };
    /**
     * @typedef {Object} DebreifingScreen~Data
     * @property {Number} missionState (enum missions.MissionState)
     * @property {String} performance
     * @property {String} nextPerformanceScore
     * @property {Number} score 
     * @property {Boolean} isRecord
     * @property {Number} elapsedTime
     * @property {Number} kills
     * @property {Number} damageDealt
     * @property {Number} hitRatio
     * @property {Number} hullIntegrity
     * @property {Number} teamSurvival
     * @property {Number} baseScore
     * @property {Number} hitRatioBonus
     * @property {Number} hullIntegrityBonus
     * @property {Number} teamSurvivalBonus
     */
    /**
     * Sets the contents of the screen's HTML element to show the passed data (score, statistics...) of the mission
     * @param {DebreifingScreen~Data} data
     */
    DebriefingScreen.prototype.setData = function (data) {
        var medalText, hasScore, description;
        hasScore = (data.missionState === missions.MissionState.COMPLETED);
        _shouldPlayVictoryMusic = (data.missionState === missions.MissionState.COMPLETED) ||
                (data.missionState === missions.MissionState.NONE);
        medalText = hasScore ? strings.get(strings.PERFORMANCE_LEVEL.PREFIX, data.performance) : "";
        this._title.setContent((data.missionState === missions.MissionState.COMPLETED) ?
                strings.get(strings.DEBRIEFING.VICTORY_TITLE) :
                ((data.missionState === missions.MissionState.NONE) ?
                        strings.get(strings.DEBRIEFING.GENERIC_TITLE) :
                        strings.get(strings.DEBRIEFING.DEFEAT_TITLE)));
        this._medal.getElement().src = utils.formatString(MEDAL_IMAGE_SOURCE, {
            performance: (data.missionState !== missions.MissionState.NONE) ? data.performance : MEDAL_IMAGE_NO_SCORE
        });
        this._scoreContainer.setVisible(hasScore);
        this._scoreSpan.setVisible(hasScore);
        if (this._scoreSpan.isVisible()) {
            this._scoreSpan.setContent(strings.get(strings.DEBRIEFING.SCORE), {
                score: data.score
            });
        }
        this._newRecord.setVisible(hasScore && data.isRecord);
        switch (data.missionState) {
            case missions.MissionState.COMPLETED:
                description =
                        utils.formatString(strings.get(strings.DEBRIEFING.DESCRIPTION_VICTORY), {
                            performance: strings.getDefiniteArticleForWord(medalText) + " <strong>" + medalText + "</strong>"
                        }) +
                        (data.nextPerformanceScore ? utils.formatString(strings.get(strings.DEBRIEFING.DESCRIPTION_NEXT_PERFORMANCE), {
                            score: data.nextPerformanceScore
                        }) : "");
                break;
            case missions.MissionState.NONE:
                description = strings.get(strings.DEBRIEFING.DESCRIPTION_GENERIC);
                break;
            case missions.MissionState.FAILED:
                description = strings.get(strings.DEBRIEFING.DESCRIPTION_FAIL);
                break;
            case missions.MissionState.DEFEAT:
                description = strings.get(strings.DEBRIEFING.DESCRIPTION_DEFEAT);
                break;
            default:
                description = strings.get(strings.DEBRIEFING.DESCRIPTION_LEFT_EARLY);
        }
        this._descriptionParagraph.setContent(description);
        this._timeCell.setContent(utils.formatTimeToMinutes(data.elapsedTime));
        this._killsCell.setContent(data.kills.toString());
        this._damageCell.setContent(data.damageDealt.toString());
        this._hitRatioCell.setContent(Math.round(100 * data.hitRatio) + "%");
        this._hullIntegrityCell.setContent(Math.round(100 * data.hullIntegrity) + "%");
        this._teamSurvivalCell.setContent((data.teamSurvival !== undefined) ? (Math.round(100 * data.teamSurvival) + "%") : "-");
        this._scoreBreakdownContainer.setVisible(hasScore);
        if (this._scoreBreakdownContainer.isVisible()) {
            this._baseScoreCell.setContent(data.baseScore.toString());
            this._hitRatioBonusCell.setContent(data.hitRatioBonus.toString());
            this._hullIntegrityBonusCell.setContent(data.hullIntegrityBonus.toString());
            this._teamSurvivalBonusCell.setContent(data.teamSurvivalBonus ? data.teamSurvivalBonus.toString() : "-");
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        debriefingScreen: new DebriefingScreen()
    };
});