/**
 * Copyright 2016 Krisztián Nagy
 * @file The main module for the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, localStorage, require, Blob, window */
/*jslint white: true, nomen: true, plusplus: true */

/**
 * @param application Used for logging, configuration setup and downloading files
 * @param resources Used for loading the resource configuration and displaying it in the Resources window
 * @param constants Used for accessing the previously run version number in the local storage
 * @param config Used to load game configuration and settings from file
 * @param graphics Used to load the graphics settings from file
 * @param classes Used to display the class structure in the Items window and access the selected class for preview and properties
 * @param logic Used to load the environments 
 * @param common Used for clearing open popups
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
    "editor/common",
    "editor/spacecraft-preview",
    "editor/descriptors",
    "editor/properties"
], function (application, resources, constants, config, graphics, classes, logic, common, spacecraftPreview, descriptors, properties) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Constants
            ITEMS_WINDOW_ID = "items",
            PREVIEW_WINDOW_ID = "preview",
            PROPERTIES_WINDOW_ID = "properties",
            EXPORT_BUTTON_ID = "exportButton",
            EXPORT_DIALOG_ID = "classesExportDialog",
            EXPORT_NAME_ID = "classesExportName",
            EXPORT_AUTHOR_ID = "classesExportAuthor",
            EXPORT_EXPORT_BUTTON_ID = "classesExportExport",
            EXPORT_CANCEL_BUTTON_ID = "classesExportCancel",
            WINDOW_LABEL_CLASS = "windowLabel",
            WINDOW_CONTENT_CLASS = "windowContent",
            SELECTED_CLASS = "selected",
            CATEGORY_CLASS = "category",
            ELEMENT_LIST_CLASS = "elementList",
            ELEMENT_CLASS = "element",
            PREVIEW_OPTIONS_ID = "previewOptions",
            PREVIEW_CANVAS_ID = "previewCanvas",
            PREVIEW_INFO_ID = "previewInfo",
            NO_ITEM_SELECTED_TEXT = "select an item from the left",
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
                type: common.ItemType.NONE,
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
        if (_selectedItem.type === common.ItemType.NONE) {
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
     * A function to execute whenever the name property of the selected item is changed
     * @param {String} newName
     */
    function _handleNameChange(newName) {
        _selectedItemElement.innerHTML = newName;
    }
    /**
     * Loads the content of the Properties window for the currently selected element.
     */
    function _loadProperties() {
        var windowContent = document.getElementById(PROPERTIES_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS);
        windowContent.innerHTML = "";
        if (_selectedItem.type === common.ItemType.NONE) {
            windowContent.appendChild(_createLabel(NO_ITEM_SELECTED_TEXT));
        } else if (!descriptors.itemDescriptors[_selectedItem.category]) {
            windowContent.appendChild(_createLabel(NO_PROPERTIES_TEXT));
        } else {
            properties.createProperties(windowContent, _selectedItem, _previews[_selectedItem.category], _handleNameChange);
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
            _selectedItem.reference = common.getItemReference(_selectedItem);
            _selectedItem.data = _selectedItem.reference.getData();
            common.removePopups();
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
     * Returns the stringified info object that can be embedded at the beginning of exported files (e.g. classes)
     * @param {String} name The name to be included in the info
     * @param {String} author The author to be included in the info
     * @returns {String}
     */
    function _getInfoString(name, author) {
        var info = {
            name: name,
            author: author,
            comment: "Created by Interstellar Armada editor",
            version: application.getVersion(),
            creationTime: new Date().toString()
        };
        return JSON.stringify(info);
    }
    /**
     * Returns the string that can be used as the content of the exported classes file 
     * @param {String} name The name to be included in the info section of the file
     * @param {String} author The author to be included in the info section of the file
     * @returns {String}
     */
    function _getClassesString(name, author) {
        var i, j, classCategories = classes.getClassCategories(), classesOfCategory, result;
        result = '{"info":' + _getInfoString(name, author);
        for (i = 0; i < classCategories.length; i++) {
            result += ',"' + classCategories[i] + '":[';
            classesOfCategory = classes.getClassNames(classCategories[i]);
            for (j = 0; j < classesOfCategory.length; j++) {
                result += ((j > 0) ? ',' : '') + JSON.stringify(classes.getClass(classCategories[i], classesOfCategory[j]).getData());
            }
            result += ']';
        }
        result += "}";
        return result;
    }
    /**
     * Exports the class settings into a JSON file the download of which is then triggered
     * @param {String} name The name to be included in the info section of the file
     * @param {String} author The author to be included in the info section of the file
     */
    function _exportClasses(name, author) {
        var
                blob = new Blob([_getClassesString(name, author)], {type: "text/json"}),
                e = document.createEvent("MouseEvents"),
                a = document.createElement("a");
        a.download = name + ".json";
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ["text/json", a.download, a.href].join(":");
        e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(e);
    }
    /**
     * Sets up the event handlers for the elements in the classes export dialog
     */
    function _loadClassesExportDialog() {
        var
                classesExportDialog = document.getElementById(EXPORT_DIALOG_ID),
                classesExportName = document.getElementById(EXPORT_NAME_ID),
                classesExportAuthor = document.getElementById(EXPORT_AUTHOR_ID),
                classesExportExport = document.getElementById(EXPORT_EXPORT_BUTTON_ID),
                classesExportCancel = document.getElementById(EXPORT_CANCEL_BUTTON_ID);
        classesExportExport.onclick = function () {
            _exportClasses(classesExportName.value, classesExportAuthor.value);
            classesExportDialog.hidden = true;
        };
        classesExportCancel.onclick = function () {
            classesExportDialog.hidden = true;
        };
    }
    /**
     * Creates and returns a collapsable list (<ul> tag) containing the categories of the game items belonging to the passed type.
     * @param {String} itemType (enum ItemType)
     * @returns {Element}
     */
    function _createCategoryList(itemType) {
        var categories, categoryList, categoryElement, categorySpan, items, itemList, itemElement, itemSpan, i, j, getItems;
        switch (itemType) {
            case common.ItemType.RESOURCE:
                categories = resources.getResourceTypes();
                getItems = resources.getResourceNames;
                break;
            case common.ItemType.CLASS:
                categories = classes.getClassCategories();
                getItems = classes.getClassNames;
                break;
            default:
                application.crash();
        }
        categoryList = document.createElement("ul");
        for (i = 0; i < categories.length; i++) {
            categoryElement = document.createElement("li");
            categoryElement.classList.add(CATEGORY_CLASS);
            categorySpan = document.createElement("span");
            categorySpan.classList.add(CATEGORY_CLASS);
            categorySpan.innerHTML = categories[i];
            categoryElement.appendChild(categorySpan);
            itemList = document.createElement("ul");
            itemList.classList.add(ELEMENT_LIST_CLASS);
            items = getItems(categories[i]);
            for (j = 0; j < items.length; j++) {
                itemElement = document.createElement("li");
                itemSpan = document.createElement("span");
                itemSpan.classList.add(ELEMENT_CLASS);
                itemSpan.innerHTML = items[j];
                itemElement.appendChild(itemSpan);
                itemSpan.onclick = _createElementClickHandler(itemSpan, itemType, items[j], categories[i]);
                itemList.appendChild(itemElement);
            }
            itemList.hidden = true;
            categoryElement.appendChild(itemList);
            categorySpan.onclick = _toggleList.bind(this, itemList);
            categoryList.appendChild(categoryElement);
        }
        return categoryList;
    }
    /**
     * Loads the content of the Items window - collapsable lists of game items of each category. Call after the configuration has been 
     * loaded.
     */
    function _loadItems() {
        var
                windowContent = document.getElementById(ITEMS_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS),
                exportDialog = document.getElementById(EXPORT_DIALOG_ID);
        _hideLabel(windowContent);
        windowContent.appendChild(_createCategoryList(common.ItemType.RESOURCE));
        windowContent.appendChild(_createCategoryList(common.ItemType.CLASS));
        document.getElementById(EXPORT_BUTTON_ID).onclick = function () {
            exportDialog.hidden = !exportDialog.hidden;
        };
        _loadClassesExportDialog();
    }
    /**
     * Sends an asynchronous request to get the JSON file describing the game settings and sets the callback function to set them and
     * load the content of the Items window
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
                    _setLabel(document.getElementById(PREVIEW_WINDOW_ID), NO_ITEM_SELECTED_TEXT);
                    _setLabel(document.getElementById(PROPERTIES_WINDOW_ID), NO_ITEM_SELECTED_TEXT);
                    _loadItems();
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
