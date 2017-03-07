/**
 * Copyright 2016-2017 Krisztián Nagy
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
 * @param spacecraft Used for creating the spacecraft representing the player craft in missions for previewing its data
 * @param missions Used for accessing information about missions
 */
define([
    "utils/utils",
    "modules/game",
    "modules/screens",
    "modules/components",
    "armada/strings",
    "armada/audio",
    "armada/screens/shared",
    "armada/logic/spacecraft",
    "armada/logic/missions"
], function (utils, game, screens, components, strings, audio, armadaScreens, spacecraft, missions) {
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
            MISSION_LOCATION_ID = "missionLocation",
            DIFFICULTY_CONTAINER_ID = "difficultyContainer",
            DIFFICULTY_SELECTOR_ID = "difficultySelector",
            MISSION_DESCRIPTION_ID = "missionDescription",
            LIST_COMPONENT_NAME = "list",
            MEDAL_IMAGE_HTML = "<img class='missionMedal' src='images/empire_{performance}_20.png' alt='{performance}'>",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Used to represent the player's spacecraft in the currently selected mission to show information about it
             * @type Spacecraft
             */
            _spacecraft;
    function _mapDifficultyName(difficulty) {
        return strings.get(strings.SETTING.PREFIX, difficulty);
    }
    function _getDifficultyValues() {
        return missions.getDifficultyNames().map(_mapDifficultyName);
    }
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
                {
                    show: function () {
                        audio.resetMasterVolume();
                        audio.resetMusicVolume();
                        audio.playMusic(armadaScreens.MENU_THEME);
                    }
                },
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
        this._missionLocation = this.registerSimpleComponent(MISSION_LOCATION_ID);
        /**
         * @type SimpleComponent
         */
        this._difficultySelector = null;
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
        missions.executeWhenReady(function () {
            this._difficultySelector = this.registerExternalComponent(
                    new components.Selector(
                            DIFFICULTY_SELECTOR_ID,
                            armadaScreens.SELECTOR_SOURCE,
                            {
                                cssFilename: armadaScreens.SELECTOR_CSS,
                                selectorClassName: "smallSelector",
                                propertyContainerClassName: "smallSelectorPropertyContainer"
                            },
                            {id: strings.MISSIONS.DIFFICULTY.name},
                            _getDifficultyValues()),
                    DIFFICULTY_CONTAINER_ID);
        }.bind(this));
    }
    MissionsScreen.prototype = new screens.HTMLScreen();
    MissionsScreen.prototype.constructor = MissionsScreen;
    /**
     * Creates and returns the objects that can be passed for the constructor to create the list elements based on mission data
     * @returns {ListComponent~ListElement[]} 
     */
    MissionsScreen.prototype._getListElements = function () {
        var result = [], missionNames = missions.getMissionNames(), i;
        for (i = 0; i < missionNames.length; i++) {
            result.push({
                captionID: strings.MISSION.PREFIX.name + utils.getFilenameWithoutExtension(missionNames[i]) + strings.MISSION.NAME_SUFFIX.name,
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
        var missionFilename, missionName, pilotedCraftDescriptor;
        if (index >= 0) {
            missionFilename = missions.getMissionNames()[index];
            missionName = utils.getFilenameWithoutExtension(missionFilename);
            this._missionTitle.setContent(strings.get({name: strings.MISSION.PREFIX.name + missionName + strings.MISSION.NAME_SUFFIX.name}));
            this._missionDescription.setContent(strings.get(strings.MISSIONS.LOADING_DESCRIPTION));
            this._missionObjectivesTitle.hide();
            this._missionObjectives.hide();
            this._playerSpacecraftTitle.hide();
            this._playerSpacecraftData.hide();
            missions.requestMissionDescriptor(missionFilename, function (missionDescriptor) {
                var
                        /** @type String[] */
                        objectives;
                if (this._listComponent.getSelectedIndex() === index) {
                    if (_spacecraft) {
                        _spacecraft.destroy();
                        _spacecraft = null;
                    }
                    pilotedCraftDescriptor = missionDescriptor.getPilotedSpacecraftDescriptor();
                    if (pilotedCraftDescriptor) {
                        _spacecraft = new spacecraft.Spacecraft();
                        _spacecraft.loadFromJSON(pilotedCraftDescriptor);
                    }
                    objectives = missionDescriptor.getMissionObjectives().map(function (objective) {
                        return "<li>" + objective + "</li>";
                    });
                    this._missionLocation.setContent(strings.get(strings.MISSIONS.LOCATION) + " " + missionDescriptor.getEnvironment().getDisplayName());
                    this._missionDescription.setContent(missionDescriptor.getDisplayDescription());
                    this._missionObjectives.setContent(objectives.join(""));
                    if (_spacecraft) {
                        this._playerSpacecraftData.setContent(strings.get(strings.MISSIONS.SPACECRAFT_DATA), {
                            class: _spacecraft.getClass().getDisplayName(),
                            firepower: _spacecraft.getFirepower().toFixed(1)
                        });
                    } else {
                        this._playerSpacecraftData.setContent("-");
                    }
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
            this._missionLocation.setContent("");
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
                this._launchMission(false);
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
        var missionDescriptors, i;
        missionDescriptors = missions.getMissionDescriptors();
        i = 0;
        this._listComponent.executeForListElements(function (listElement) {
            var
                    score = missionDescriptors[i].getBestScore(),
                    performance = missionDescriptors[i].getBestPerformance(),
                    winCount = missionDescriptors[i].getWinCount(),
                    subcaption = listElement.querySelector("." + armadaScreens.SUBCAPTION_CLASS_NAME);
            subcaption.innerHTML = utils.formatString(
                    ((winCount > 0) ?
                            ((score === undefined) ?
                                    strings.get(strings.MISSIONS.SANDBOX_COMPLETED) :
                                    strings.get(strings.MISSIONS.BEST_SCORE)) :
                            strings.get(strings.MISSIONS.NOT_COMPLETED)), {
                score: score,
                medal: performance ? utils.formatString(MEDAL_IMAGE_HTML, {
                    performance: performance
                }) : " - "
            });
            if (winCount > 0) {
                subcaption.classList.add(COMPLETED_CLASS);
            } else {
                subcaption.classList.remove(COMPLETED_CLASS);
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
     * Launches the currently selected mission
     * @param {Boolean} demoMode whether to load the mission in demo mode
     */
    MissionsScreen.prototype._launchMission = function (demoMode) {
        var missionIndex = this._listComponent.getSelectedIndex();
        if (missionIndex >= 0) {
            audio.playMusic(null);
            game.setScreen(armadaScreens.BATTLE_SCREEN_NAME);
            game.getScreen().startNewBattle({
                missionSourceFilename: missions.getMissionNames()[missionIndex],
                difficulty: missions.getDifficultyNames()[this._difficultySelector.getSelectedIndex()],
                demoMode: demoMode});
        }
    };
    /**
     * Updates the displayed selector values (i.e. difficulty) based on the game state
     */
    MissionsScreen.prototype._updateValues = function () {
        missions.executeWhenReady(function () {
            this._difficultySelector.selectValueWithIndex(missions.getDifficultyNames().indexOf(missions.getDifficulty()));
        }.bind(this));
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
        this._difficultySelector.onChange = function () {
            missions.setDifficulty(missions.getDifficultyNames()[this._difficultySelector.getSelectedIndex()]);
            this._updateScores();
        }.bind(this);
        this._demoButton.getElement().onclick = function () {
            this._launchMission(true);
            return false;
        }.bind(this);
        this._launchButton.getElement().onclick = function () {
            this._launchMission(false);
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    MissionsScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._difficultySelector.setValueList(_getDifficultyValues());
        this._updateValues();
        this._updateScores();
    };
    /**
     * @override
     * @returns {Boolean}
     */
    MissionsScreen.prototype.show = function () {
        if (screens.HTMLScreen.prototype.show.call(this)) {
            this._updateValues();
            return true;
        }
        return false;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        missionsScreen: new MissionsScreen()
    };
});