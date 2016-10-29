/**
 * Copyright 2016 Krisztián Nagy
 * @file This module manages and provides the Missions screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, window, document, setInterval, clearInterval */

/**
 * @param utils Used for trimming extension from file names
 * @param game Used for navigation and displaying the game version
 * @param screens The about screen is a subclass of HTMLScreen
 * @param components A ListComponent is used to select missions
 * @param strings Used for translation support
 * @param audio Used for music management (switching track when launching a mission)
 * @param armadaScreens Used for navigation
 * @param level Used for accessing information about missions
 */
define([
    "utils/utils",
    "modules/game",
    "modules/screens",
    "modules/components",
    "armada/strings",
    "armada/audio",
    "armada/screens/shared",
    "armada/logic/level"
], function (utils, game, screens, components, strings, audio, armadaScreens, level) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            MISSION_LIST_CONTAINER_CLASS = "missionListContainer",
            COMPLETED_CLASS = "completed",
            BACK_BUTTON_ID = "backButton",
            DEMO_BUTTON_ID = "demoButton",
            LAUNCH_BUTTON_ID = "launchButton",
            MISSION_TITLE_ID = "missionTitle",
            MISSION_DESCRIPTION_ID = "missionDescription",
            LIST_COMPONENT_NAME = "list";
    // #########################################################################
    /**
     * @class Provides the behaviour for the Missions screen
     * @extends HTMLScreen
     */
    function MissionsScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.MISSIONS_SCREEN_NAME,
                armadaScreens.MISSIONS_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.MISSIONS_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                undefined, // no screen event handlers as of yet
                this._getKeyCommands(),
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /**
         * The ID of the HTML element inside of which the mission list component will be added
         * @type String
         */
        this._listContainerID = armadaScreens.MISSIONS_LIST_CONTAINER_ID;
        /**
         * @type SimpleComponent
         */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /**
         * @type SimpleComponent
         */
        this._missionTitle = this.registerSimpleComponent(MISSION_TITLE_ID);
        /**
         * @type SimpleComponent
         */
        this._missionDescription = this.registerSimpleComponent(MISSION_DESCRIPTION_ID);
        /**
         * @type SimpleComponent
         */
        this._missionObjectivesTitle = this.registerSimpleComponent("missionObjectivesTitle");
        /**
         * @type SimpleComponent
         */
        this._missionObjectives = this.registerSimpleComponent("missionObjectives");
        /**
         * @type SimpleComponent
         */
        this._playerSpacecraftTitle = this.registerSimpleComponent("playerSpacecraftTitle");
        /**
         * @type SimpleComponent
         */
        this._playerSpacecraftData = this.registerSimpleComponent("playerSpacecraftData");
        /**
         * @type SimpleComponent
         */
        this._demoButton = this.registerSimpleComponent(DEMO_BUTTON_ID);
        /**
         * @type SimpleComponent
         */
        this._launchButton = this.registerSimpleComponent(LAUNCH_BUTTON_ID);
        /**
         * The component housing the mission list
         * @type MenuComponent
         */
        this._listComponent = this.registerExternalComponent(
                new components.ListComponent(
                        LIST_COMPONENT_NAME,
                        armadaScreens.LIST_COMPONENT_SOURCE,
                        {
                            cssFilename: armadaScreens.LIST_COMPONENT_CSS,
                            listClassName: armadaScreens.LIST_CLASS_NAME,
                            listContainerClassName: MISSION_LIST_CONTAINER_CLASS,
                            elementClassName: armadaScreens.LIST_ELEMENT_CLASS_NAME,
                            elementContainerClassName: armadaScreens.LIST_ELEMENT_CONTAINER_CLASS_NAME,
                            captionClassName: armadaScreens.CAPTION_CLASS_NAME,
                            subcaptionClassName: armadaScreens.SUBCAPTION_CLASS_NAME,
                            disabledElementClassName: components.DISABLED_CLASS_NAME,
                            selectedElementClassName: components.SELECTED_CLASS_NAME,
                            highlightedElementClassName: components.HIGHLIGHTED_CLASS_NAME
                        },
                        this._getListElements(),
                        true,
                        {
                            elementhighlight: function () {
                                armadaScreens.playButtonSelectSound(true);
                            },
                            elementselect: function (index, enabled) {
                                armadaScreens.playButtonClickSound(enabled);
                                this._selectMission(index);
                            }.bind(this)
                        }),
                this._listContainerID);
    }
    MissionsScreen.prototype = new screens.HTMLScreen();
    MissionsScreen.prototype.constructor = MissionsScreen;
    /**
     * Creates and returns the objects that can be passed for the constructor to create the list elements based on mission data
     * @returns {ListComponent~ListElement[]} 
     */
    MissionsScreen.prototype._getListElements = function () {
        var result = [], levelNames = level.getLevelNames(), i;
        for (i = 0; i < levelNames.length; i++) {
            result.push({
                captionID: strings.LEVEL.PREFIX.name + utils.getFilenameWithoutExtension(levelNames[i]) + strings.LEVEL.NAME_SUFFIX.name,
                subcaptionID: strings.MISSIONS.NOT_COMPLETED.name
            });
        }
        return result;
    };
    /**
     * Requests the data of the selected mission and displays its information once it has been loaded
     * @param {Number} index
     */
    MissionsScreen.prototype._selectMission = function (index) {
        var levelFilename, levelName;
        if (index >= 0) {
            levelFilename = level.getLevelNames()[index];
            levelName = utils.getFilenameWithoutExtension(levelFilename);
            this._missionTitle.setContent(strings.get({name: strings.LEVEL.PREFIX.name + levelName + strings.LEVEL.NAME_SUFFIX.name}));
            this._missionDescription.setContent(strings.get(strings.MISSIONS.LOADING_DESCRIPTION));
            this._missionObjectivesTitle.hide();
            this._missionObjectives.hide();
            this._playerSpacecraftTitle.hide();
            this._playerSpacecraftData.hide();
            level.requestLevelDescriptor(levelFilename, function (levelDescriptor) {
                var
                        /** @type SpacecraftClass */
                        pilotedSpacecraftClass,
                        /** @type String[] */
                        objectives;
                if (this._listComponent.getSelectedIndex() === index) {
                    pilotedSpacecraftClass = levelDescriptor.getPilotedSpacecraftClass();
                    objectives = levelDescriptor.getMissionObjectives().map(function (objective) {
                        return "<li>" + objective + "</li>";
                    });
                    this._missionDescription.setContent(strings.get(strings.MISSIONS.DESCRIPTION), {
                        description: levelDescriptor.getDisplayDescription()
                    });
                    this._missionObjectives.setContent(objectives.join(""));
                    this._playerSpacecraftData.setContent(strings.get(strings.MISSIONS.SPACECRAFT_DATA), {
                        class: pilotedSpacecraftClass.getDisplayName()
                    });
                    this._missionObjectivesTitle.show();
                    this._missionObjectives.show();
                    this._playerSpacecraftTitle.show();
                    this._playerSpacecraftData.show();
                }
            }.bind(this));
            this._launchButton.enable();
            this._demoButton.enable();
        } else {
            this._missionTitle.setContent(strings.get(strings.MISSIONS.NO_SELECTED_NAME));
            this._missionDescription.setContent(strings.get(strings.MISSIONS.NO_SELECTED_DESCRIPTION));
            this._missionObjectivesTitle.hide();
            this._missionObjectives.hide();
            this._playerSpacecraftTitle.hide();
            this._playerSpacecraftData.hide();
            this._launchButton.disable();
            this._demoButton.disable();
        }
    };
    /**
     * Adds the screen key commands (up-down-enter-space-esc) to the given key commands object and returns the
     * result.
     * @param {Object.<String, Function>} [keyCommands] If not given, an object with just the screen key commands
     * will be returned.
     */
    MissionsScreen.prototype._getKeyCommands = function (keyCommands) {
        keyCommands = keyCommands || {};
        keyCommands.up = keyCommands.up || function (event) {
            this._listComponent.highlightPrevious();
            event.preventDefault();
        }.bind(this);
        keyCommands.down = keyCommands.down || function (event) {
            this._listComponent.highlightNext();
            event.preventDefault();
        }.bind(this);
        keyCommands.enter = keyCommands.enter || function () {
            if ((this._listComponent.getSelectedIndex() >= 0) && (this._listComponent.getHighlightedIndex() === this._listComponent.getSelectedIndex())) {
                this._launchLevel(false);
            } else {
                this._listComponent.selectHighlighted();
            }
        }.bind(this);
        keyCommands.space = keyCommands.space || function (event) {
            this._listComponent.selectHighlighted();
            event.preventDefault();
        }.bind(this);
        keyCommands.escape = function () {
            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
        };
        return keyCommands;
    };
    /**
     * Updates the subcaption for all missions in the displayed list with the current best score for the mission
     */
    MissionsScreen.prototype._updateScores = function () {
        var levelDescriptors, i;
        levelDescriptors = level.getLevelDescriptors();
        i = 0;
        this._listComponent.executeForListElements(function (listElement) {
            var
                    score = levelDescriptors[i].getBestScore(),
                    winCount = levelDescriptors[i].getWinCount(),
                    subcaption = listElement.querySelector("." + armadaScreens.SUBCAPTION_CLASS_NAME);
            subcaption.innerHTML = utils.formatString(
                    ((winCount > 0) ?
                            ((score === undefined) ?
                                    strings.get(strings.MISSIONS.SANDBOX_COMPLETED) :
                                    strings.get(strings.MISSIONS.BEST_SCORE)) :
                            strings.get(strings.MISSIONS.NOT_COMPLETED)), {
                score: score
            });
            if (winCount > 0) {
                subcaption.classList.add(COMPLETED_CLASS);
            }
            i++;
        });
    };
    /**
     * @override
     * @param {Boolean} active
     */
    MissionsScreen.prototype.setActive = function (active) {
        screens.HTMLScreen.prototype.setActive.call(this, active);
        if (active) {
            this._updateScores();
            this._listComponent.reset();
            this._selectMission(-1);
        }
    };
    /**
     * Launches the currently selected level
     * @param {Boolean} demoMode whether to load the level in demo mode
     */
    MissionsScreen.prototype._launchLevel = function (demoMode) {
        var levelIndex = this._listComponent.getSelectedIndex();
        if (levelIndex >= 0) {
            audio.playMusic(null);
            game.setScreen(armadaScreens.BATTLE_SCREEN_NAME);
            game.getScreen().startNewBattle({
                levelSourceFilename: level.getLevelNames()[levelIndex],
                demoMode: demoMode});
        }
    };
    /**
     * @override
     */
    MissionsScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
            return false;
        }.bind(this);
        this._demoButton.getElement().onclick = function () {
            this._launchLevel(true);
            return false;
        }.bind(this);
        this._launchButton.getElement().onclick = function () {
            this._launchLevel(false);
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    MissionsScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._updateScores();
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        missionsScreen: new MissionsScreen()
    };
});