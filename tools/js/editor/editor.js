/**
 * Copyright 2016 Krisztián Nagy
 * @file The main module for the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, localStorage, require */
/*jslint white: true, nomen: true, plusplus: true */

/**
 * @param application Used for logging, configuration setup and downloading files
 * @param resources Used for loading the resource configuration and displaying it in the Resources window
 * @param constants Used for accessing the previously run version number in the local storage
 * @param config Used to load game configuration and settings from file
 * @param graphics Used to load the graphics settings from file
 * @param classes Used to display the class structure in the Classes window and access the selected class for preview and properties
 * @param logic Used to load the environments 
 * @param spacecraftPreview Used to create previews for spacecraft classes
 * @param descriptors Used to determine whether the descriptor for a specific resource / class category is available
 * @param properties Used to generate the content of the Properties window
 */
define([
    "modules/application",
    "modules/media-resources",
    "armada/constants",
    "armada/configuration",
    "armada/graphics",
    "armada/classes",
    "armada/logic",
    "editor/spacecraft-preview",
    "editor/descriptors",
    "editor/properties"
], function (application, resources, constants, config, graphics, classes, logic, spacecraftPreview, descriptors, properties) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Enums
            /**
             * Selectable items must be one of these types
             * @enum {String}
             * @type Object
             */
            ItemType = {
                NONE: "none",
                RESOURCE: "resource",
                CLASS: "class"
            },
    // ------------------------------------------------------------------------------
    // Constants
    RESOURCES_WINDOW_ID = "resources",
            CLASSES_WINDOW_ID = "classes",
            PREVIEW_WINDOW_ID = "preview",
            PROPERTIES_WINDOW_ID = "properties",
            WINDOW_LABEL_CLASS = "windowLabel",
            WINDOW_CONTENT_CLASS = "windowContent",
            SELECTED_CLASS = "selected",
            CATEGORY_CLASS = "category",
            ELEMENT_LIST_CLASS = "elementList",
            ELEMENT_CLASS = "element",
            PREVIEW_OPTIONS_ID = "previewOptions",
            PREVIEW_CANVAS_ID = "previewCanvas",
            PREVIEW_INFO_ID = "previewInfo",
            NO_ITEM_SELECTED_TEXT = "no item selected",
            NO_PREVIEW_TEXT = "preview not available for this type of item",
            NO_PROPERTIES_TEXT = "properties not available for this type of item",
            // ------------------------------------------------------------------------------
            // Private variables
            /**
             * The content of the Preview window for an item belonging to a specific category is generated based on the module stored within this
             * object, at the key that is the same as the category name
             * @type Object
             */
            _previews = {
                "spacecraftClasses": spacecraftPreview
            },
    /**
     * The HTML element (<span>) that corresponds to the currently selected item
     * @type Element
     */
    _selectedItemElement,
            /**
             * The data of the currently selected item
             * @type Editor~Item
             */
            _selectedItem = {
                type: ItemType.NONE,
                name: "",
                category: "",
                reference: null,
                data: null
            };
    // ------------------------------------------------------------------------------
    // Private functions
    /**
     * Toggles a (sub)list between expanded / collapsed state.
     * @param {Element} listElement The HTML element representing the list. (e.g. <ul>)
     */
    function _toggleList(listElement) {
        listElement.hidden = !listElement.hidden;
    }
    /**
     * Creates and returns a <div> element with the CSS class associated with (window) labels and the passed text.
     * @param {String} text
     * @returns {Element}
     */
    function _createLabel(text) {
        var label = document.createElement("div");
        label.classList.add(WINDOW_LABEL_CLASS);
        label.innerHTML = text;
        return label;
    }
    /**
     * Hides the window label that is below the passed element in the DOM.
     * @param {Element} parent
     */
    function _hideLabel(parent) {
        var label = parent.querySelector("div." + WINDOW_LABEL_CLASS);
        label.hidden = true;
    }
    /**
     * Sets a new text for the window label that is below the passed element in the DOM.
     * @param {Element} parent
     * @param {String} text
     */
    function _setLabel(parent, text) {
        var label = parent.querySelector("div." + WINDOW_LABEL_CLASS);
        label.hidden = false;
        label.innerHTML = text;
    }
    /**
     * Loads the content of the Preview window for the currently selected element.
     */
    function _loadPreview() {
        var
                previewWindowContent = document.getElementById(PREVIEW_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS),
                previewOptions = previewWindowContent.querySelector("div#" + PREVIEW_OPTIONS_ID),
                previewCanvas = document.getElementById(PREVIEW_CANVAS_ID),
                previewInfo = document.getElementById(PREVIEW_INFO_ID);
        if (_selectedItem.type === ItemType.NONE) {
            previewCanvas.hidden = true;
            previewOptions.hidden = true;
            previewInfo.hidden = true;
            _setLabel(previewWindowContent, NO_ITEM_SELECTED_TEXT);
        } else if (!_previews[_selectedItem.category]) {
            previewCanvas.hidden = true;
            previewOptions.hidden = true;
            previewInfo.hidden = true;
            _setLabel(previewWindowContent, NO_PREVIEW_TEXT);
        } else {
            _hideLabel(previewWindowContent);
            _previews[_selectedItem.category].refresh({
                options: previewOptions,
                canvas: previewCanvas,
                info: previewInfo
            }, _selectedItem.reference);
        }
    }
    /**
     * Loads the content of the Properties window for the currently selected element.
     */
    function _loadProperties() {
        var windowContent = document.getElementById(PROPERTIES_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS);
        windowContent.innerHTML = "";
        if (_selectedItem.type === ItemType.NONE) {
            windowContent.appendChild(_createLabel(NO_ITEM_SELECTED_TEXT));
        } else if (!descriptors[_selectedItem.category]) {
            windowContent.appendChild(_createLabel(NO_PROPERTIES_TEXT));
        } else {
            properties.createProperties(windowContent, _selectedItem, _previews[_selectedItem.category]);
        }
    }
    /**
     * Sets the data for a new selected item and load the appropriate Preview and Properties windows for it, if available
     * @param {String} type (enum ItemType) The type of the selected item
     * @param {String} name The name (id) of the selected item
     * @param {String} category The category the selected item belongs to (this will determine the format of the Preview and Properties 
     * windows
     */
    function _selectItem(type, name, category) {
        if ((_selectedItem.type !== type) || (_selectedItem.name !== name) || (_selectedItem.category !== category)) {
            _selectedItem.type = type;
            _selectedItem.name = name;
            _selectedItem.category = category;
            switch (_selectedItem.type) {
                case ItemType.RESOURCE:
                    _selectedItem.reference = resources.getResource(_selectedItem.category, _selectedItem.name);
                    break;
                case ItemType.CLASS:
                    _selectedItem.reference = classes.getClass(_selectedItem.category, _selectedItem.name);
                    break;
                default:
                    application.crash();
            }
            _selectedItem.data = _selectedItem.reference.getData();
            _loadProperties();
            _loadPreview();
        }
    }
    /**
     * Creates and returns a function that can be used as the onclick event handler on an element representing a selectable item (such as
     * a resource or game class)
     * @param {Element} element The element that represents the item (typically <span>, showing the name of the item)
     * @param {String} type (enum ItemType) The type this item belongs to
     * @param {String} name The name of the item (identifying it within its category) (e.g. "falcon")
     * @param {String} category The category the item belongs to (e.g. "spacecraftClasses")
     * @param {Object} data The data (JSON object) the given item is initialized from
     * @returns {Function}
     */
    function _createElementClickHandler(element, type, name, category, data) {
        return function () {
            if (_selectedItemElement) {
                _selectedItemElement.classList.remove(SELECTED_CLASS);
            }
            _selectItem(type, name, category, data);
            _selectedItemElement = element;
            _selectedItemElement.classList.add(SELECTED_CLASS);
        };
    }
    /**
     * Loads the content of the Resources window - the collapsable list of game media resources. Call after the resource configuration has
     * been loaded.
     */
    function _loadResources() {
        var
                resourcesWindowContent = document.getElementById(RESOURCES_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS),
                resourceTypes = resources.getResourceTypes(), resourcesOfType,
                typeList, typeElement, typeSpan, resourceList, resourceElement, resourceSpan,
                i, j;
        _hideLabel(resourcesWindowContent);
        typeList = document.createElement("ul");
        for (i = 0; i < resourceTypes.length; i++) {
            typeElement = document.createElement("li");
            typeElement.classList.add(CATEGORY_CLASS);
            typeSpan = document.createElement("span");
            typeSpan.classList.add(CATEGORY_CLASS);
            typeSpan.innerHTML = resourceTypes[i];
            typeElement.appendChild(typeSpan);
            resourceList = document.createElement("ul");
            resourceList.classList.add(ELEMENT_LIST_CLASS);
            resourcesOfType = resources.getResourceNames(resourceTypes[i]);
            for (j = 0; j < resourcesOfType.length; j++) {
                resourceElement = document.createElement("li");
                resourceSpan = document.createElement("span");
                resourceSpan.classList.add(ELEMENT_CLASS);
                resourceSpan.innerHTML = resourcesOfType[j];
                resourceElement.appendChild(resourceSpan);
                resourceSpan.onclick = _createElementClickHandler(resourceSpan, ItemType.RESOURCE, resourcesOfType[j], resourceTypes[i]);
                resourceList.appendChild(resourceElement);
                resourceList.hidden = true;
            }
            typeElement.appendChild(resourceList);
            typeSpan.onclick = _toggleList.bind(this, resourceList);
            typeList.appendChild(typeElement);
        }
        resourcesWindowContent.appendChild(typeList);
    }
    /**
     * Loads the content of the Classes window - the collapsable list of game classes. Call after the class configuration has been loaded.
     */
    function _loadClasses() {
        var
                classesWindowContent = document.getElementById(CLASSES_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS),
                classCategories = classes.getClassCategories(), classesOfCategory,
                categoryList, categoryElement, categorySpan, classList, classElement, classSpan,
                i, j;
        _hideLabel(classesWindowContent);
        categoryList = document.createElement("ul");
        for (i = 0; i < classCategories.length; i++) {
            categoryElement = document.createElement("li");
            categoryElement.classList.add(CATEGORY_CLASS);
            categorySpan = document.createElement("span");
            categorySpan.classList.add(CATEGORY_CLASS);
            categorySpan.innerHTML = classCategories[i];
            categoryElement.appendChild(categorySpan);
            classList = document.createElement("ul");
            classList.classList.add(ELEMENT_LIST_CLASS);
            classesOfCategory = classes.getClassNames(classCategories[i]);
            for (j = 0; j < classesOfCategory.length; j++) {
                classElement = document.createElement("li");
                classSpan = document.createElement("span");
                classSpan.classList.add(ELEMENT_CLASS);
                classSpan.innerHTML = classesOfCategory[j];
                classElement.appendChild(classSpan);
                classSpan.onclick = _createElementClickHandler(classSpan, ItemType.CLASS, classesOfCategory[j], classCategories[i]);
                classList.appendChild(classElement);
                classList.hidden = true;
            }
            categoryElement.appendChild(classList);
            categorySpan.onclick = _toggleList.bind(this, classList);
            categoryList.appendChild(categoryElement);
        }
        classesWindowContent.appendChild(categoryList);
    }
    /**
     * Sends an asynchronous request to get the JSON file describing the game settings and sets the callback function to set them and
     * load the content of the Resources and Classes windows
     * @param {{folder: String, filename: String}} settingsFileDescriptor
     */
    function _requestSettingsLoad(settingsFileDescriptor) {
        application.requestTextFile(settingsFileDescriptor.folder, settingsFileDescriptor.filename, function (settingsText) {
            var settingsJSON = JSON.parse(settingsText);
            application.log("Loading game settings...", 1);
            graphics.loadSettingsFromJSON(settingsJSON.graphics);
            graphics.loadSettingsFromLocalStorage();
            config.loadSettingsFromJSON(settingsJSON.logic);
            config.executeWhenReady(function () {
                logic.requestEnvironmentsLoad();
                logic.executeWhenReady(function () {
                    application.log("Game settings loaded.", 1);
                    localStorage[constants.VERSION_LOCAL_STORAGE_ID] = application.getVersion();
                    application.log("Initialization completed.");
                    _loadResources();
                    _loadClasses();
                });
            });
        });
    }
    /**
     * Starts the whole initialization / setup process by sending an asynchronous request to get the JSON file describing the game 
     * configuration and setting the callback to continue when it is loaded.
     */
    function _requestConfigLoad() {
        application.requestTextFile("config", "config.json", function (configText) {
            var configJSON = JSON.parse(configText);
            application.log("Loading configuration...");
            application.setFolders(configJSON.folders);
            application.setLogVerbosity(configJSON.logVerbosity);
            application.setVersion(configJSON.version);
            application.setDebugVersion(configJSON.debugVersion);
            application.log("Game version is: " + application.getVersion(), 1);

            require([
                "modules/media-resources"
            ], function (resources) {
                config.loadConfigurationFromJSON(configJSON.dataFiles.logic);
                graphics.loadConfigurationFromJSON(configJSON.graphics);
                resources.requestConfigLoad(configJSON.dataFiles.media.resources, function () {
                    application.log("Configuration loaded.");
                });
                _requestSettingsLoad(configJSON.configFiles.settings);
            });
        });
    }
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        initialize: function () {
            application.setPreviouslyRunVersion(localStorage[constants.VERSION_LOCAL_STORAGE_ID]);
            _requestConfigLoad();
        }
    };
});
