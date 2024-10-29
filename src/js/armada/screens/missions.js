/**
 * Copyright 2016-2024 Krisztián Nagy
 * @file This module manages and provides the Missions screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for trimming extension from file names
 * @param game Used for navigation and displaying the game version
 * @param screens The about screen is a subclass of HTMLScreen
 * @param components A ListComponent is used to select missions
 * @param analytics Used for reporting custom mission load events
 * @param strings Used for translation support
 * @param audio Used for music management (switching track when launching a mission)
 * @param config
 * @param armadaScreens Used for navigation
 * @param spacecraft Used for creating the spacecraft representing the player craft in missions for previewing its data
 * @param missions Used for accessing information about missions
 * @param missionHub Used for accessing information about community missions from the Mission Hub
 */
define([
    "utils/utils",
    "modules/game",
    "modules/screens",
    "modules/components",
    "modules/analytics",
    "armada/strings",
    "armada/audio",
    "armada/configuration",
    "armada/screens/shared",
    "armada/logic/spacecraft",
    "armada/logic/missions",
    "armada/logic/mission-hub"
], function (utils, game, screens, components, analytics, strings, audio, config, armadaScreens, spacecraft, missions, missionHub) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            MISSION_LIST_CONTAINER_CLASS = "missionListContainer",
            COMPLETED_CLASS = "completed",
            TITLE_ID = "title",
            BACK_BUTTON_ID = "backButton",
            DEMO_BUTTON_ID = "demoButton",
            LAUNCH_BUTTON_ID = "launchButton",
            MISSION_TITLE_ID = "missionTitle",
            MISSION_LOCATION_ID = "missionLocation",
            DIFFICULTY_CONTAINER_ID = "difficultyContainer",
            DIFFICULTY_SELECTOR_ID = "difficultySelector",
            MISSION_DESCRIPTION_ID = "missionDescription",
            FILE_BUTTON_ID = "fileButton",
            SUBMIT_BUTTON_ID = "submitButton",
            SUBMIT_FILE_BUTTON_ID = "submitFileButton",
            FILE_INPUT_ID = "fileInput",
            SUBMIT_MISSION_HELP_BUTTON_ID = "helpButton",
            SUBMIT_MISSION_POPUP_BACKGROUND_ID = "submitMissionPopupBackground",
            SUBMIT_MISSION_SENDER_NAME_INPUT_ID = "submitMissionSenderName",
            SUBMIT_MISSION_PASSWORD_INPUT_ID = "submitMissionPassword",
            SUBMIT_MISSION_PASSWORD_EYE_ID = "submitMissionPasswordEye",
            SUBMIT_MISSION_COMMENT_INPUT_ID = "submitMissionComment",
            SUBMIT_MISSION_TERMS_CHECKGROUP_ID = "submitMissionTermsCheckGroup",
            SUBMIT_MISSION_TERMS_CONTAINER_ID = "submitMissionTermsContainer",
            SUBMIT_MISSION_SUBMIT_BUTTON_ID = "submitMissionSubmitButton",
            SUBMIT_MISSION_CANCEL_BUTTON_ID = "submitMissionCancelButton",
            MANAGE_SUBMISSIONS_BUTTON_ID = "manageSubmissionsButton",
            MANAGE_SUBMISSIONS_POPUP_BACKGROUND_ID = "manageSubmissionsPopupBackground",
            SUBMISSION_TITLE_COLUMN_CLASS = "submissionTitleColumn",
            SUBMISSION_DATE_COLUMN_CLASS = "submissionDateColumn",
            SUBMISSION_STATUS_COLUMN_CLASS = "submissionStatusColumn",
            SUBMISSION_STATS_COLUMN_CLASS = "submissionStatsColumn",
            SUBMISSION_ACTIONS_COLUMN_CLASS = "submissionActionsColumn",
            MANAGE_SUBMISSIONS_CLOSE_BUTTON_ID = "manageSubmissionsCloseButton",
            SUBMISSIONS_LIST_ID = "submissionsList",
            INFO_BOX_ID = "infoBox",
            LOADING_BOX_ID = "loadingBox",
            MISSION_HUB_TERMS_LINK_ID = "missionHubTermsLink",
            MIN_SENDER_NAME_LENGTH = 3,
            MAX_SENDER_NAME_LENGTH = 20,
            MIN_PASSWORD_LENGTH = 8,
            MAX_PASSWORD_LENGTH = 32,
            MAX_COMMENT_LENGTH = 200,
            MAX_MISSION_SIZE = 100 * 1024,
            MIN_TITLE_LENGTH = 3,
            MAX_TITLE_LENGTH = 30,
            MIN_DESCRIPTION_LENGTH = 10,
            SUBMISSION_DATE_FORMAT_OPTIONS = {
                day: "numeric",
                month: "long",
                year: "numeric"
            },
            // backend error codes - need to be kept sync with the backend version
            ErrorCategory = {
                AUTHORIZATION: 100,
                INVALID_GENERAL_PARAMS: 200,
                INVALID_SUBMIT_PARAMS: 300,
                DATABASE_OPERATION: 400,
                AUTHENTICATION: 500,
                RATE_LIMIT: 600,
                OTHER: 700
            },
            InvalidSubmitParamError = {
                MISSING_BODY: 1,
                INVALID_NAME: 2,
                INVALID_PASSWORD: 3,
                INVALID_COMMENT: 4,
                WRONG_MISSION_FILE_FORMAT: 5,
                MISSION_FILE_TOO_LARGE: 6,
                SENDER_CREATOR_MISMATCH: 7,
                INVALID_MISSION_TITLE: 8,
                INVALID_MISSION_DESCRIPTON: 9,
                NO_SPACECRAFTS: 10,
                NO_PILOTED_CRAFT: 11
            },
            OtherError = {
                TITLE_ALREADY_EXISTS: 1
            },
            // end of backend error codes
            VALID = 0,
            SUBMIT_MISSION_TEXT_PARAMS = {
                minNameLength: MIN_SENDER_NAME_LENGTH,
                maxNameLength: MAX_SENDER_NAME_LENGTH,
                minPasswordLength: MIN_PASSWORD_LENGTH,
                maxPasswordLength: MAX_PASSWORD_LENGTH,
                maxCommentLength: MAX_COMMENT_LENGTH,
                maxFileSize: utils.getFileSizeString(MAX_MISSION_SIZE),
                minTitleLength: MIN_TITLE_LENGTH,
                maxTitleLength: MAX_TITLE_LENGTH,
                minDescriptionLength: MIN_DESCRIPTION_LENGTH
            },
            LIST_COMPONENT_NAME = "list",
            MEDAL_IMAGE_HTML = "<img class='missionMedal' src='assets/images/empire_{performance}_20.png' alt='{performance}'>",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Used to represent the player's spacecraft in the currently selected mission to show information about it
             * @type Spacecraft
             */
            _spacecraft;
    function _validateString(value, min, max) {
        return (typeof value === "string") && ((min === undefined) || (value.length >= min)) && ((max === undefined) || (value.length <= max));
    }
    function mapDifficultyName(difficulty) {
        return strings.get(strings.SETTING.PREFIX, difficulty);
    }
    function getDifficultyValues() {
        return missions.getDifficultyNames().map(mapDifficultyName);
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
                        audio.playMusic(armadaScreens.BRIEFING_THEME, undefined, undefined, false);
                    }
                },
                this._getKeyCommands(),
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /**
         * Whether to show custom missions or non-custom (official) ones
         * @type Boolean
         */
        this._custom = false;
        /**
         * Whether to show an extra entry after the missions to allow loading of custom missions
         * @type Boolean
         */
        this._loadCustom = false;
        /**
         * Whether we are showing community missions (from the Mission Hub instead of the player's
         * computer)
         * @type Boolean
         */
        this._community = false;
        /**
         * The text content of the mission file selected by the player to be submitted to the Mission Hub
         * @type String
         */
        this._missionToSubmit = null;
        /**
         * Either the missions module for local missions or the missionHub module for community missions
         * @type Object
         */
        this._missionProvider = missions;
        /**
         * Whether the help dialog for mission submission has already been displayed at least once
         * @type Boolean
         */
        this._submitHelpShown = false;
        /**
         * The ID of the HTML element inside of which the mission list component will be added
         * @type String
         */
        this._listContainerID = armadaScreens.MISSIONS_LIST_CONTAINER_ID;
        /** @type SimpleComponent */
        this._title = this.registerSimpleComponent(TITLE_ID);
        /** @type SimpleComponent */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /** @type SimpleComponent */
        this._missionTitle = this.registerSimpleComponent(MISSION_TITLE_ID);
        /** @type SimpleComponent */
        this._missionLocation = this.registerSimpleComponent(MISSION_LOCATION_ID);
        /** @type Selector */
        this._difficultySelector = null;
        /** @type SimpleComponent */
        this._missionDescription = this.registerSimpleComponent(MISSION_DESCRIPTION_ID);
        /** @type SimpleComponent */
        this._missionObjectivesTitle = this.registerSimpleComponent("missionObjectivesTitle");
        /** @type SimpleComponent */
        this._missionObjectives = this.registerSimpleComponent("missionObjectives");
        /** @type SimpleComponent */
        this._playerSpacecraftTitle = this.registerSimpleComponent("playerSpacecraftTitle");
        /** @type SimpleComponent */
        this._playerSpacecraftData = this.registerSimpleComponent("playerSpacecraftData");
        /** @type SimpleComponent */
        this._playerSpacecraftWeapons = this.registerSimpleComponent("playerSpacecraftWeapons");
        /** @type SimpleComponent */
        this._playerSpacecraftMissiles = this.registerSimpleComponent("playerSpacecraftMissiles");
        /** @type SimpleComponent */
        this._playerSpacecraftShield = this.registerSimpleComponent("playerSpacecraftShield");
        /** @type SimpleComponent */
        this._playerSpacecraftPropulsion = this.registerSimpleComponent("playerSpacecraftPropulsion");
        /** @type SimpleComponent */
        this._fileInput = this.registerSimpleComponent(FILE_INPUT_ID);
        /** @type SimpleComponent */
        this._fileButton = this.registerSimpleComponent(FILE_BUTTON_ID);
        /** @type SimpleComponent */
        this._submitButton = this.registerSimpleComponent(SUBMIT_BUTTON_ID);
        /** @type SimpleComponent */
        this._demoButton = this.registerSimpleComponent(DEMO_BUTTON_ID);
        /** @type SimpleComponent */
        this._launchButton = this.registerSimpleComponent(LAUNCH_BUTTON_ID);
        /** @type SimpleComponent */
        this._submitMissionHelpButton = this.registerSimpleComponent(SUBMIT_MISSION_HELP_BUTTON_ID);
        /** @type SimpleComponent */
        this._submitMissionPopupBackground = this.registerSimpleComponent(SUBMIT_MISSION_POPUP_BACKGROUND_ID);
        /** @type SimpleComponent */
        this._submitMissionSenderNameInput = this.registerSimpleComponent(SUBMIT_MISSION_SENDER_NAME_INPUT_ID);
        /** @type SimpleComponent */
        this._submitMissionPasswordInput = this.registerSimpleComponent(SUBMIT_MISSION_PASSWORD_INPUT_ID);
        /** @type SimpleComponent */
        this._submitMissionPasswordEye = this.registerSimpleComponent(SUBMIT_MISSION_PASSWORD_EYE_ID);
        /** @type SimpleComponent */
        this._submitMissionCommentInput = this.registerSimpleComponent(SUBMIT_MISSION_COMMENT_INPUT_ID);
        /** @type SimpleComponent */
        this._submitFileButton = this.registerSimpleComponent(SUBMIT_FILE_BUTTON_ID);
        /** @type SimpleComponent */
        this._submitMissionCancelButton = this.registerSimpleComponent(SUBMIT_MISSION_CANCEL_BUTTON_ID);
        /** @type SimpleComponent */
        this._submitMissionSubmitButton = this.registerSimpleComponent(SUBMIT_MISSION_SUBMIT_BUTTON_ID);
        /** @type SimpleComponent */
        this._manageSubmissionsButton = this.registerSimpleComponent(MANAGE_SUBMISSIONS_BUTTON_ID);
        /** @type SimpleComponent */
        this._manageSubmissionsPopupBackground = this.registerSimpleComponent(MANAGE_SUBMISSIONS_POPUP_BACKGROUND_ID);
        /** @type SimpleComponent */
        this._manageSubmissionsCloseButton = this.registerSimpleComponent(MANAGE_SUBMISSIONS_CLOSE_BUTTON_ID);
        /** @type SimpleComponent */
        this._submissionsList = this.registerSimpleComponent(SUBMISSIONS_LIST_ID);
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
        /**
         * @type LoadingBox
         */
        this._loadingBox = this.registerExternalComponent(new components.LoadingBox(
                LOADING_BOX_ID,
                armadaScreens.LOADING_BOX_SOURCE,
                {cssFilename: armadaScreens.LOADING_BOX_CSS},
                strings.LOADING.HEADER.name));
        /**
         * @type CheckGroup
         */
        this._submitMissionTermsCheckbox = this.registerExternalComponent(new components.CheckGroup(
                SUBMIT_MISSION_TERMS_CHECKGROUP_ID,
                armadaScreens.CHECK_GROUP_SOURCE,
                {
                    cssFilename: armadaScreens.CHECK_GROUP_CSS
                },
                [{
                        id: strings.MISSIONS.SUBMIT_MISSION_ACCEPT_TERMS.name,
                        replacements: {
                            linkBegin: '<a id="' + MISSION_HUB_TERMS_LINK_ID + '" target="_blank" rel="noreferrer">',
                            linkEnd: '</a>'
                        },
                        value: "accept"
                    }],
                {
                    select: armadaScreens.playButtonSelectSound,
                    change: function () {
                        armadaScreens.playButtonClickSound(true);
                        this._updateSubmitMissionButton();
                    }.bind(this),
                    click: function (event) {
                        return event.target.tagName.toLowerCase() !== 'a';
                    }
                }
        ), SUBMIT_MISSION_TERMS_CONTAINER_ID);
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
                            getDifficultyValues()),
                    DIFFICULTY_CONTAINER_ID);
        }.bind(this));
        this._updateSubmitMissionButton = this._updateSubmitMissionButton.bind(this);
    }
    MissionsScreen.prototype = new screens.HTMLScreen();
    MissionsScreen.prototype.constructor = MissionsScreen;
    /**
     * @typedef {Object} MissionScreenConfig
     * @property {Boolean} custom
     * @property {Boolean} loadCustom
     * @property {Boolean} community 
     */
    /**
     * Call before displaying the page to set up what missions to show
     * @param {MissionScreenConfig} config
     */
    MissionsScreen.prototype.setup = function (config) {
        this._custom = config.custom;
        this._loadCustom = config.loadCustom;
        this._community = config.community;
        this._missionProvider = config.community ? missionHub : missions;
        this._listComponent.setListElements(this._getListElements());
    };
    /**
     * Creates and returns the objects that can be passed for the constructor to create the list elements based on mission data
     * @returns {ListComponent~ListElement[]} 
     */
    MissionsScreen.prototype._getListElements = function () {
        var result = [], missionNames = this._missionProvider.getMissionNames(this._custom), i, missionTitles;
        if (this._custom && !this._community) {
            missionTitles = [];
            for (i = 0; i < missionNames.length; i++) {
                missionTitles.push(this._missionProvider.getMissionDescriptor(missionNames[i]).getTitle());
            }
        }
        for (i = 0; i < missionNames.length; i++) {
            result.push({
                captionID: (this._community || this._custom) ? undefined : strings.MISSION.PREFIX.name + utils.getFilenameWithoutExtension(missionNames[i]) + strings.MISSION.NAME_SUFFIX.name,
                caption: this._community ? missionNames[i] : this._custom ? missionTitles[i] || utils.getFilenameWithoutExtension(missionNames[i]) : undefined,
                subcaptionID: strings.MISSIONS.NOT_COMPLETED.name
            });
        }
        if (this._loadCustom) {
            result.push({
                captionID: strings.MISSIONS.CUSTOM_MISSION_CAPTION.name,
                subcaptionID: strings.MISSIONS.CUSTOM_MISSION_SUBCAPTION.name
            });
        }
        return result;
    };
    /**
     * Private helper function to display the proper error message in case a request
     * to the Mission Hub fails
     * @param {Boolean} quitScreen 
     * @param {Object} data
     */
    MissionsScreen.prototype._handleMissionHubError = function (quitScreen, data) {
        if ((game.getScreen() !== this) || !this._community) {
            return;
        }
        this._loadingBox.hide();
        this._showMessage(
                strings.get(
                        strings.MISSION_HUB_ERROR.PREFIX,
                        (data && data.error) || strings.MISSION_HUB_ERROR.DEFAULT_SUFFIX.name,
                        utils.formatString(strings.get(strings.MISSION_HUB_ERROR.GENERAL), {code: data ? data.error : 0})),
                function () {
                    if (quitScreen) {
                        game.closeOrNavigateTo(armadaScreens.SINGLE_PLAYER_SCREEN_NAME);
                    }
                }.bind(this));
    };
    /**
     * Requests the data of the selected mission and displays its information once it has been loaded
     * @param {Number} index
     */
    MissionsScreen.prototype._selectMission = function (index) {
        var missionFilename, missionName, pilotedCraftDescriptor;
        if ((index >= 0) && (index < this._missionProvider.getMissionNames(this._custom).length)) {
            missionFilename = this._missionProvider.getMissionNames(this._custom)[index];
            missionName = utils.getFilenameWithoutExtension(missionFilename);
            this._missionTitle.setTextContent(strings.get({name: strings.MISSION.PREFIX.name + missionName + strings.MISSION.NAME_SUFFIX.name}, undefined, missionName));
            this._missionDescription.setTextContent(strings.get(strings.MISSIONS.LOADING_DESCRIPTION));
            this._missionObjectivesTitle.hide();
            this._missionObjectives.hide();
            this._playerSpacecraftTitle.hide();
            this._playerSpacecraftData.hide();
            this._playerSpacecraftWeapons.hide();
            this._playerSpacecraftMissiles.hide();
            this._playerSpacecraftShield.hide();
            this._playerSpacecraftPropulsion.hide();
            this._fileButton.hide();
            this._submitButton.hide();
            this._manageSubmissionsButton.hide();
            this._missionProvider.requestMissionDescriptor(missionFilename, function (missionDescriptor) {
                var
                        author,
                        /** @type String[] */
                        objectives;
                if (this._listComponent.getSelectedIndex() === index) {
                    if (missionDescriptor.getTitle()) {
                        this._missionTitle.setTextContent(missionDescriptor.getTitle());
                        this._listComponent.setCaption(index, missionDescriptor.getTitle());
                    }
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
                    this._missionLocation.setTextContent(strings.get(strings.MISSIONS.LOCATION) + " " + missionDescriptor.getEnvironment().getDisplayName());
                    this._missionDescription.setContent("");
                    if (missionDescriptor.isCustom()) {
                        if (missionDescriptor.getAuthor()) {
                            author = document.createElement("span");
                            author.textContent = utils.formatString(strings.get(strings.MISSIONS.CREATED_BY), {author: missionDescriptor.getAuthor()});
                            this._missionDescription.getElement().appendChild(author);
                            this._missionDescription.getElement().appendChild(document.createElement("br"));
                            this._missionDescription.getElement().appendChild(document.createElement("br"));
                        }
                        components.appendFormattedContent(this._missionDescription.getElement(), missionDescriptor.getDescription() || missionDescriptor.getDisplayDescription());
                    } else {
                        components.appendFormattedContent(this._missionDescription.getElement(), missionDescriptor.getDisplayDescription());
                    }
                    this._missionObjectives.setContent(objectives.join(""));
                    if (_spacecraft) {
                        this._playerSpacecraftData.setContent(strings.get(strings.MISSIONS.SPACECRAFT_DATA), {
                            class: _spacecraft.getClass().getDisplayName()
                        });
                        if (_spacecraft.hasWeapons()) {
                            this._playerSpacecraftWeapons.setContent(strings.get(strings.MISSIONS.SPACECRAFT_WEAPONS), {
                                weapons: _spacecraft.getWeaponsDisplayText() || "-",
                                firepower: _spacecraft.getFirepower().toFixed(1),
                                range: _spacecraft.hasWeapons() ? _spacecraft.getWeaponRangesDisplayText() + " m" : "-"
                            });
                            this._playerSpacecraftWeapons.show();
                        } else {
                            this._playerSpacecraftWeapons.setContent("");
                            this._playerSpacecraftWeapons.hide();
                        }
                        if (_spacecraft.hasMissiles()) {
                            this._playerSpacecraftMissiles.setContent(strings.get(strings.MISSIONS.SPACECRAFT_MISSILES), {
                                missiles: _spacecraft.getMissilesDisplayText() || "-",
                                firepower: _spacecraft.getMissileFirepower(),
                                range: _spacecraft.getMissileRangesDisplayText() + " m"
                            });
                            this._playerSpacecraftMissiles.show();
                        } else {
                            this._playerSpacecraftMissiles.setContent("");
                            this._playerSpacecraftMissiles.hide();
                        }
                        if (_spacecraft.hasShield()) {
                            this._playerSpacecraftShield.setContent(strings.get(strings.MISSIONS.SPACECRAFT_SHIELD), {
                                shield: _spacecraft.hasShield() ? _spacecraft.getShieldDisplayName() : "-",
                                shieldCapacity: _spacecraft.hasShield() ? _spacecraft.getShieldCapacity() : "-",
                                shieldRechargeRate: _spacecraft.hasShield() ? _spacecraft.getShieldRechargeRate() + " / s" : "-"
                            });
                            this._playerSpacecraftShield.show();
                        } else {
                            this._playerSpacecraftShield.setContent("");
                            this._playerSpacecraftShield.hide();
                        }
                        if (_spacecraft.getPropulsion()) {
                            this._playerSpacecraftPropulsion.setContent(strings.get(strings.MISSIONS.SPACECRAFT_PROPULSION), {
                                propulsion: _spacecraft.getPropulsion() ? _spacecraft.getPropulsionDisplayName() : "-",
                                speed: _spacecraft.getPropulsion() ? Math.round(_spacecraft.getMaxCombatSpeed()) + " m/s" : "-",
                                turnRate: _spacecraft.getPropulsion() ? Math.round(_spacecraft.getMaxCombatTurnRate()) + " °/s" : "-"
                            });
                            this._playerSpacecraftPropulsion.show();
                        } else {
                            this._playerSpacecraftPropulsion.setContent("");
                            this._playerSpacecraftPropulsion.hide();
                        }
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
            this._missionDescription.setContent(strings.get(this._loadCustom ?
                    strings.MISSIONS.CUSTOM_DESCRIPTION :
                    this._community ?
                    (missionHub.isReady() ? strings.MISSIONS.MISSION_HUB_DESCRIPTION : strings.MISSIONS.MISSION_HUB_CONNECTING_DESCRIPTION) :
                    strings.MISSIONS.NO_SELECTED_DESCRIPTION), {
                editor: '<a target="_blank" rel="noopener" href="editor.html#missions">Interstellar Armada editor</a>'
            });
            this._missionObjectivesTitle.hide();
            this._missionObjectives.hide();
            this._playerSpacecraftTitle.hide();
            this._playerSpacecraftData.hide();
            this._playerSpacecraftWeapons.hide();
            this._playerSpacecraftMissiles.hide();
            this._playerSpacecraftShield.hide();
            this._playerSpacecraftPropulsion.hide();
            this._launchButton.disable();
            this._demoButton.disable();
            this._fileButton.setVisible(this._loadCustom);
            this._submitButton.setVisible(this._community && missionHub.isReady());
            this._manageSubmissionsButton.setVisible(this._community && missionHub.isReady() && missionHub.isSubmitter());
            if (this._community && !missionHub.isReady()) {
                missionHub.retrieveMissions(function () {
                    if ((game.getScreen() !== this) || !this._community) {
                        return;
                    }
                    this._listComponent.setListElements(this._getListElements());
                    this._updateScores();
                    this._selectMission(-1);
                }.bind(this), this._handleMissionHubError.bind(this, true));
            }
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
            if (!this._submitMissionPopupBackground.isVisible() && !this._manageSubmissionsPopupBackground.isVisible()) {
                this._listComponent.highlightPrevious();
                event.preventDefault();
            }
        }.bind(this);
        keyCommands.down = keyCommands.down || function (event) {
            if (!this._submitMissionPopupBackground.isVisible() && !this._manageSubmissionsPopupBackground.isVisible()) {
                this._listComponent.highlightNext();
                event.preventDefault();
            }
        }.bind(this);
        keyCommands.enter = keyCommands.enter || function () {
            if (!this._submitMissionPopupBackground.isVisible() && !this._manageSubmissionsPopupBackground.isVisible()) {
                if ((this._listComponent.getSelectedIndex() >= 0) && (this._listComponent.getHighlightedIndex() === this._listComponent.getSelectedIndex())) {
                    this._launchMission(false);
                } else {
                    this._listComponent.selectHighlighted();
                }
            }
        }.bind(this);
        keyCommands.space = keyCommands.space || function (event) {
            if (!this._submitMissionPopupBackground.isVisible() && !this._manageSubmissionsPopupBackground.isVisible()) {
                this._listComponent.selectHighlighted();
                event.preventDefault();
            }
        }.bind(this);
        keyCommands.escape = function () {
            if (this._submitMissionPopupBackground.isVisible() && !this._manageSubmissionsPopupBackground.isVisible()) {
                this._submitMissionPopupBackground.hide();
            } else {
                game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
            }
        }.bind(this);
        return keyCommands;
    };
    /**
     * Shows the given message to the user in an information box.
     * @param {String} message
     * @param {Function} [onButtonClick]
     */
    MissionsScreen.prototype._showMessage = function (message, onButtonClick) {
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
     * Updates the subcaption for all missions in the displayed list with the current best score for the mission
     */
    MissionsScreen.prototype._updateScores = function () {
        var missionDescriptors, i;
        missionDescriptors = this._missionProvider.getMissionDescriptors(this._custom);
        i = 0;
        this._listComponent.executeForListElements(function (listElement) {
            var score, performance, winCount, subcaption;
            if (i < missionDescriptors.length) {
                subcaption = listElement.querySelector("." + armadaScreens.SUBCAPTION_CLASS_NAME);
                if (missionDescriptors[i].isCustom()) {
                    subcaption.innerHTML = utils.formatString(strings.get(this._community ? strings.MISSIONS.COMMUNITY_MISSION_SUBCAPTION : strings.MISSIONS.CUSTOM_MISSION_SUBCAPTION), {
                        author: missionDescriptors[i].getAuthor()
                    });
                    winCount = 0;
                } else {
                    score = missionDescriptors[i].getBestScore();
                    performance = missionDescriptors[i].getBestPerformance();
                    winCount = missionDescriptors[i].getWinCount();
                    subcaption.innerHTML = utils.formatString(
                            ((winCount > 0) ?
                                    ((score === undefined) ?
                                            strings.get(strings.MISSIONS.SANDBOX_COMPLETED) :
                                            strings.get(strings.MISSIONS.BEST_SCORE)) :
                                    strings.get(strings.MISSIONS.NOT_COMPLETED)), {
                        score: score || 0,
                        medal: performance ? utils.formatString(MEDAL_IMAGE_HTML, {
                            performance: performance
                        }) : " - "
                    });
                }
                if (winCount > 0) {
                    subcaption.classList.add(COMPLETED_CLASS);
                } else {
                    subcaption.classList.remove(COMPLETED_CLASS);
                }
            }
            i++;
        }.bind(this));
    };
    /**
     * @override
     * @param {Boolean} active
     */
    MissionsScreen.prototype.setActive = function (active) {
        screens.HTMLScreen.prototype.setActive.call(this, active);
        if (active) {
            this._title.setContent(strings.get(this._community ?
                    strings.MISSIONS.COMMUNITY_MISSIONS_TITLE :
                    this._loadCustom ? strings.MISSIONS.MY_MISSIONS_TITLE : strings.MISSIONS.CAMPAIGN_TITLE));
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
        var missionIndex = this._listComponent.getSelectedIndex(),
                missionName = this._missionProvider.getMissionNames(this._custom)[missionIndex];
        if (missionIndex >= 0) {
            audio.playMusic(null);
            game.setScreen(armadaScreens.BATTLE_SCREEN_NAME);
            game.getScreen().startNewBattle({
                missionSourceFilename: this._community ? undefined : missionName,
                missionData: this._community ? missionHub.getMissionDescriptor(missionName).getData() : undefined,
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
     * Enable/disable the submit mission data based on the current input values
     */
    MissionsScreen.prototype._updateSubmitMissionButton = function () {
        if ((this._submitMissionSenderNameInput.getElement().value.length >= MIN_SENDER_NAME_LENGTH) &&
                (this._submitMissionPasswordInput.getElement().value.length >= MIN_PASSWORD_LENGTH) &&
                (this._submitMissionTermsCheckbox.getValue().length > 0) &&
                !!this._missionToSubmit) {
            this._submitMissionSubmitButton.enable();
        } else {
            this._submitMissionSubmitButton.disable();
        }
    };
    /**
     * Shows a popup with the translated text corresponding to the passed Mission Hub error code, suitable for
     * when the error happened during validation on the client side
     * @param {Number} errorCode
     */
    MissionsScreen.prototype._showMissionHubClientError = function (errorCode) {
        this._showMessage(
                utils.formatString(strings.get(
                        strings.MISSION_HUB_CLIENT_ERROR.PREFIX,
                        errorCode,
                        utils.formatString(strings.get(strings.MISSION_HUB_CLIENT_ERROR.GENERAL), {code: errorCode})), SUBMIT_MISSION_TEXT_PARAMS));
    };
    /**
     * Cancels the mission file selected to be uploaded, also updating the corresponding button text
     */
    MissionsScreen.prototype._resetSubmitFile = function () {
        this._fileInput.getElement().value = null;
        this._missionToSubmit = null;
        this._submitFileButton.setTextContent(strings.get(strings.MISSIONS.SUBMIT_FILE_BUTTON));
        this._updateSubmitMissionButton();
    };
    /**
     * Does client side validation of mission data (done when selecting a mission file to submit
     * to the Mission Hub)
     * @param {Object} data The parsed mission JSON file
     * @returns {Number} 0 if the validation is successful, the error code otherwise
     */
    MissionsScreen.prototype._validateMissionData = function (data) {
        var piloted, spacecraft, i;
        if (!data || (typeof data !== "object") || !data.info || (typeof data.info !== "object") || !_validateString(data.info.author)) {
            return InvalidSubmitParamError.WRONG_MISSION_FILE_FORMAT;
        }
        if (data.info.author !== this._submitMissionSenderNameInput.getElement().value) {
            return InvalidSubmitParamError.SENDER_CREATOR_MISMATCH;
        }
        if (!_validateString(data.title, MIN_TITLE_LENGTH, MAX_TITLE_LENGTH)) {
            return InvalidSubmitParamError.INVALID_MISSION_TITLE;
        }
        if (!_validateString(data.description, MIN_DESCRIPTION_LENGTH)) {
            return InvalidSubmitParamError.INVALID_MISSION_DESCRIPTON;
        }
        if (!Array.isArray(data.spacecrafts)) {
            return InvalidSubmitParamError.WRONG_MISSION_FILE_FORMAT;
        }
        if (data.spacecrafts.length === 0) {
            return InvalidSubmitParamError.NO_SPACECRAFTS;
        }
        piloted = false;
        for (i = 0; i < data.spacecrafts.length; i++) {
            spacecraft = data.spacecrafts[i];
            if (!spacecraft || (typeof spacecraft !== "object")) {
                return InvalidSubmitParamError.WRONG_MISSION_FILE_FORMAT;
            }
            if (spacecraft.piloted === true) {
                piloted = true;
            } else {
                if ((typeof spacecraft.pilotedIndex === "number") && !isNaN(spacecraft.pilotedIndex)) {
                    if ((typeof spacecraft.count === "number") && !isNaN(spacecraft.count) && (spacecraft.pilotedIndex < spacecraft.count)) {
                        piloted = true;
                    }
                }
            }
        }
        if (!piloted) {
            return InvalidSubmitParamError.NO_PILOTED_CRAFT;
        }
        return VALID;
    };
    /**
     * Retrieve and display the list of missions submitted by the current player
     */
    MissionsScreen.prototype._showSubmissions = function () {
        this._loadingBox.show();
        missionHub.getSubmissions(function (missions) {
            var i, row, cell, button, date, status,
                    list = this._submissionsList.getElement(),
                    onMouseEnter = function () {
                        armadaScreens.playButtonSelectSound(true);
                    },
                    deleteButtonAction = function (index) {
                        armadaScreens.playButtonClickSound(true);
                        this._loadingBox.show();
                        missionHub.deleteSubmission(missions[index].id, function () {
                            this._loadingBox.hide();
                            this._showMessage(strings.get(strings.MISSIONS.DELETE_SUBMISSION_SUCCESS), this._showSubmissions.bind(this));
                        }.bind(this), this._handleMissionHubError.bind(this, false));
                    };
            list.innerHTML = "";
            for (i = 0; i < missions.length; i++) {
                row = document.createElement("tr");
                cell = document.createElement("td");
                cell.className = SUBMISSION_TITLE_COLUMN_CLASS;
                cell.textContent = missions[i].title;
                row.appendChild(cell);
                cell = document.createElement("td");
                cell.className = SUBMISSION_DATE_COLUMN_CLASS;
                date = new Date(missions[i].time);
                cell.textContent = date.toLocaleDateString(strings.getLocale(), SUBMISSION_DATE_FORMAT_OPTIONS);
                row.appendChild(cell);
                cell = document.createElement("td");
                cell.className = SUBMISSION_STATUS_COLUMN_CLASS;
                status = document.createElement("strong");
                status.textContent = missions[i].reviewed ?
                        strings.get(missions[i].approved ? strings.MISSIONS.SUBMISSION_STATUS_APPROVED : strings.MISSIONS.SUBMISSION_STATUS_REJECTED) :
                        strings.get(strings.MISSIONS.SUBMISSION_STATUS_PENDING);
                cell.appendChild(status);
                if (missions[i].reviewed && missions[i].review) {
                    status = document.createElement("span");
                    status.textContent = " " + missions[i].review;
                    cell.appendChild(status);
                }
                row.appendChild(cell);
                cell = document.createElement("td");
                cell.className = SUBMISSION_STATS_COLUMN_CLASS;
                cell.innerHTML =
                        utils.formatString(strings.get(strings.MISSIONS.SUBMISSION_STATS_STARTED), { count: missions[i].start }) + "<br>" +
                        utils.formatString(strings.get(strings.MISSIONS.SUBMISSION_STATS_WON), { count: missions[i].win }) + "<br>" +
                        utils.formatString(strings.get(strings.MISSIONS.SUBMISSION_STATS_LOST), { count: missions[i].lose });
                row.appendChild(cell);
                cell = document.createElement("td");
                cell.className = SUBMISSION_ACTIONS_COLUMN_CLASS;
                button = document.createElement("button");
                button.textContent = strings.get(missions[i].approved ? strings.MISSIONS.DELETE_SUBMISSION_BUTTON : strings.MISSIONS.REVOKE_SUBMISSION_BUTTON);
                button.onmouseenter = onMouseEnter;
                button.onclick = deleteButtonAction.bind(this, i);
                cell.appendChild(button);
                row.appendChild(cell);
                list.appendChild(row);
            }
            this._loadingBox.hide();
            this._manageSubmissionsPopupBackground.show();
        }.bind(this), this._handleMissionHubError.bind(this, false));
    };
    /**
     * @override
     */
    MissionsScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.SINGLE_PLAYER_SCREEN_NAME);
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
        this._fileInput.getElement().onchange = function () {
            var file = this._fileInput.getElement().files[0];
            if (file) {
                if (this._community) {
                    if (file.size > MAX_MISSION_SIZE) {
                        this._showMissionHubClientError(ErrorCategory.INVALID_SUBMIT_PARAMS + InvalidSubmitParamError.MISSION_FILE_TOO_LARGE);
                        this._resetSubmitFile();
                        return;
                    }
                }
                file.text().then(function (text) {
                    var data, validationResult;
                    try {
                        data = JSON.parse(text);
                    } catch (error) {
                        if (this._community) {
                            this._showMissionHubClientError(ErrorCategory.INVALID_SUBMIT_PARAMS + InvalidSubmitParamError.WRONG_MISSION_FILE_FORMAT);
                            this._resetSubmitFile();
                        } else {
                            game.showError("The selected file is not a valid mission file!", game.ErrorSeverity.MINOR);
                        }
                        return;
                    }
                    if (data) {
                        if (this._loadCustom) {
                            data.name = file.name;
                            data.custom = true;
                            if (missions.getMissionNames().indexOf(data.name) >= 0) {
                                game.showError("A mission with this filename already exists!", game.ErrorSeverity.MINOR);
                            } else {
                                missions.createMissionDescriptor(data);
                                this._listComponent.setCaption(missions.getMissionNames(this._custom).length - 1, data.title || utils.getFilenameWithoutExtension(data.name));
                                this.selectMission(data.name);
                                this._listComponent.addListElement({
                                    captionID: strings.MISSIONS.CUSTOM_MISSION_CAPTION.name,
                                    subcaptionID: strings.MISSIONS.CUSTOM_MISSION_SUBCAPTION.name
                                });
                                analytics.sendEvent("customload");
                            }
                        } else if (this._community) {
                            validationResult = this._validateMissionData(data);
                            if (validationResult === VALID) {
                                this._missionToSubmit = text;
                                this._submitFileButton.setTextContent(file.name);
                                this._updateSubmitMissionButton();
                            } else {
                                this._showMissionHubClientError(ErrorCategory.INVALID_SUBMIT_PARAMS + validationResult);
                                this._resetSubmitFile();
                            }
                        }
                    }
                }.bind(this)).catch(function () {
                    game.showError("The selected file doesn't seem to be a valid mission file!", game.ErrorSeverity.MINOR);
                });
            }
        }.bind(this);
        this._fileButton.getElement().onclick = function () {
            this._fileInput.getElement().click();
            return false;
        }.bind(this);
        this._submitButton.getElement().onclick = function () {
            this._updateSubmitMissionButton();
            this._submitMissionPopupBackground.show();
            if (!this._submitHelpShown) {
                this._submitMissionHelpButton.getElement().click();
                this._submitHelpShown = true;
            }
        }.bind(this);
        this._submitMissionHelpButton.getElement().onclick = function () {
            armadaScreens.openDialog({
                header: strings.get(strings.INFO_BOX.HEADER),
                message: utils.formatString(strings.get(strings.MISSIONS.SUBMIT_MISSION_HELP), SUBMIT_MISSION_TEXT_PARAMS),
                messageClass: armadaScreens.RELEASE_NOTES_CLASS_NAME,
                buttons: [{
                        caption: strings.get(strings.INFO_BOX.OK_BUTTON),
                        action: function () {
                            game.closeSuperimposedScreen();
                        }
                    }]
            });
        }.bind(this);
        this._submitMissionSenderNameInput.getElement().maxLength = MAX_SENDER_NAME_LENGTH;
        this._submitMissionSenderNameInput.getElement().onkeyup = this._updateSubmitMissionButton;
        this._submitMissionPasswordInput.getElement().maxLength = MAX_PASSWORD_LENGTH;
        this._submitMissionPasswordInput.getElement().onkeyup = this._updateSubmitMissionButton;
        this._submitMissionPasswordEye.getElement().onmousedown = function () {
            this._submitMissionPasswordInput.getElement().classList.add(components.FOCUSING_CLASS_NAME);
        }.bind(this);
        this._submitMissionPasswordEye.getElement().onmouseup = function () {
            this._submitMissionPasswordInput.getElement().classList.remove(components.FOCUSING_CLASS_NAME);
        }.bind(this);
        this._submitMissionPasswordEye.getElement().onclick = function (event) {
            var classList = this._submitMissionPasswordEye.getElement().classList;
            classList.toggle(components.EYE_CROSSED_CLASS_NAME);
            this._submitMissionPasswordInput.setAttribute("type", classList.contains(components.EYE_CROSSED_CLASS_NAME) ? "text" : "password");
            this._submitMissionPasswordInput.getElement().focus();
            event.preventDefault();
        }.bind(this);
        this._submitMissionCommentInput.getElement().maxLength = MAX_COMMENT_LENGTH;
        this._submitFileButton.getElement().onclick = function () {
            this._fileInput.getElement().click();
            return false;
        }.bind(this);
        this._submitMissionCancelButton.getElement().onclick = function () {
            this._submitMissionPopupBackground.hide();
        }.bind(this);
        this._submitMissionSubmitButton.getElement().onclick = function () {
            this._loadingBox.show();
            missionHub.submitMission({
                sender: this._submitMissionSenderNameInput.getElement().value,
                password: this._submitMissionPasswordInput.getElement().value,
                comment: this._submitMissionCommentInput.getElement().value,
                mission: this._missionToSubmit
            }, function () {
                this._loadingBox.hide();
                this._submitMissionPopupBackground.hide();
                this._showMessage(strings.get(strings.MISSIONS.SUBMIT_MISSION_SUCCESS));
                this._manageSubmissionsButton.show();
            }.bind(this), function (data) {
                this._loadingBox.hide();
                this._showMessage(
                        utils.formatString(strings.get(
                                strings.MISSION_HUB_ERROR.PREFIX,
                                (data && data.error) || strings.MISSION_HUB_ERROR.DEFAULT_SUFFIX.name,
                                utils.formatString(strings.get(strings.MISSION_HUB_ERROR.GENERAL), {code: data ? data.error : 0})), SUBMIT_MISSION_TEXT_PARAMS));
                if (data &&
                        (((data.error >= ErrorCategory.INVALID_SUBMIT_PARAMS + InvalidSubmitParamError.WRONG_MISSION_FILE_FORMAT) && (data.error < ErrorCategory.INVALID_SUBMIT_PARAMS + 100)) ||
                                (data.error === ErrorCategory.OTHER + OtherError.TITLE_ALREADY_EXISTS))) {
                    this._resetSubmitFile();
                }
            }.bind(this));
        }.bind(this);
        this._manageSubmissionsButton.getElement().onclick = this._showSubmissions.bind(this);
        this._manageSubmissionsCloseButton.getElement().onclick = function () {
            this._manageSubmissionsPopupBackground.hide();
        }.bind(this);
        this._fileInput.hide();
        this._submitMissionPopupBackground.hide();
        this._manageSubmissionsPopupBackground.hide();
        this._loadingBox.makeIndeterminate();
    };
    /**
     * @override
     */
    MissionsScreen.prototype._updateComponents = function () {
        var missionHubTermsLink;
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._difficultySelector.setValueList(getDifficultyValues());
        this._updateValues();
        this._updateScores();
        missionHubTermsLink = document.getElementById(MISSION_HUB_TERMS_LINK_ID);
        if (missionHubTermsLink) {
            missionHubTermsLink.href = "license/mission-hub-" + strings.getLanguage() + ".txt";
        }
        if (config.getGeneralSetting(config.GENERAL_SETTINGS.SHOW_DEMO_BUTTON)) {
            this._demoButton.show();
        } else {
            this._demoButton.hide();
        }
    };
    /**
     * @override
     * @returns {Boolean}
     */
    MissionsScreen.prototype.show = function () {
        if (screens.HTMLScreen.prototype.show.call(this)) {
            if (this._community) {
                this._resetSubmitFile();
            }
            this._updateValues();
            return true;
        }
        return false;
    };
    /**
     * Requests the data of the selected mission and displays its information once it has been loaded
     * @param {String} missionName Same as the mission file name
     */
    MissionsScreen.prototype.selectMission = function (missionName) {
        var index = this._missionProvider.getMissionNames(this._custom).indexOf(missionName);
        this._listComponent.selectIndex(index, true);
        this._selectMission(index);
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getMissionsScreen: function () {
            return new MissionsScreen();
        },
        mapDifficultyName: mapDifficultyName,
        getDifficultyValues: getDifficultyValues
    };
});