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
 * @param utils Used for deep copying 
 * @param application Used for logging, configuration setup and downloading files
 * @param resources Used for loading the resource configuration and displaying it in the Resources window
 * @param constants Used for accessing the previously run version number in the local storage
 * @param config Used to load game configuration and settings from file
 * @param graphics Used to load the graphics settings from file
 * @param classes Used to display the class structure in the Items window and access the selected class for preview and properties
 * @param missions Used to load the environments 
 * @param common Used for clearing open popups
 * @param skyboxPreview Used to create previews for skybox classes
 * @param explosionPreview Used to create previews for explosion classes
 * @param projectilePreview Used to create previews for projectile classes
 * @param weaponPreview Used to create previews for weapon classes
 * @param spacecraftPreview Used to create previews for spacecraft classes
 * @param descriptors Used to determine whether the descriptor for a specific resource / class category is available
 * @param properties Used to generate the content of the Properties window
 */
define([
    "utils/utils",
    "modules/application",
    "modules/media-resources",
    "armada/constants",
    "armada/configuration",
    "armada/graphics",
    "armada/logic/classes",
    "armada/logic/missions",
    "editor/common",
    "editor/descriptors",
    "editor/properties",
    "editor/preview/skybox-preview",
    "editor/preview/explosion-preview",
    "editor/preview/projectile-preview",
    "editor/preview/weapon-preview",
    "editor/preview/spacecraft-preview"
], function (
        utils,
        application, resources,
        constants, config, graphics, classes,
        missions,
        common, descriptors, properties,
        skyboxPreview, explosionPreview, projectilePreview, weaponPreview, spacecraftPreview) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Constants
            ITEMS_WINDOW_ID = "items",
            PREVIEW_WINDOW_ID = "preview",
            PROPERTIES_WINDOW_ID = "properties",
            // new item
            NEW_ITEM_BUTTON_ID = "newItemButton",
            NEW_ITEM_DIALOG_ID = "newItemDialog",
            NEW_ITEM_TYPE_ID = "newItemType",
            NEW_ITEM_CATEGORY_ID = "newItemCategory",
            NEW_ITEM_BASE_ID = "newItemBase",
            NEW_ITEM_NAME_ID = "newItemName",
            NEW_ITEM_CREATE_BUTTON_ID = "newItemCreate",
            NEW_ITEM_CANCEL_BUTTON_ID = "newItemCancel",
            // export items
            EXPORT_BUTTON_ID = "exportButton",
            EXPORT_DIALOG_ID = "exportDialog",
            EXPORT_TYPE_ID = "exportType",
            EXPORT_NAME_ID = "exportName",
            EXPORT_AUTHOR_ID = "exportAuthor",
            EXPORT_EXPORT_BUTTON_ID = "exportExport",
            EXPORT_CANCEL_BUTTON_ID = "exportCancel",
            // classes
            WINDOW_LABEL_CLASS = "windowLabel",
            WINDOW_CONTENT_CLASS = "windowContent",
            SELECTED_CLASS = "selected",
            ITEM_TYPE_LABEL_CLASS = "itemType",
            CATEGORY_CLASS = "category",
            ELEMENT_LIST_CLASS = "elementList",
            ELEMENT_CLASS = "element",
            ELEMENT_INSERTING_CLASS = "inserting",
            ELEMENT_DRAGOVER_CLASS = "dragover",
            ENVIRONMENTS_CATEGORY = "environments",
            MISSIONS_CATEGORY = "missions",
            ID_SEPARATOR = "_",
            ELEMENT_LI_ID_PREFIX = "element_",
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
                "skyboxClasses": skyboxPreview,
                "explosionClasses": explosionPreview,
                "projectileClasses": projectilePreview,
                "weaponClasses": weaponPreview,
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
            },
            _resourceList,
            _classList,
            _environmentList,
            _missionList;
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
     * Clears the currently open preview (if any), so that a new one can be opened (or the missing preview text shown)
     */
    function _clearPreview() {
        if ((_selectedItem.type !== common.ItemType.NONE) && (_previews[_selectedItem.category])) {
            _previews[_selectedItem.category].clear();
        }
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
     * In case the property accessed within the passed data is a reference to an item with the passed old name and in the same category 
     * as currently selected, changes the reference to the passed new name
     * @param {Object|Array} data The data within to access the property to check
     * @param {String|Number} accessor The key of the property (for objects) or the index of the element (for arrays) to access the property to check
     * @param {Type} type The type describing the accessed property
     * @param {String} oldName 
     * @param {String} newName
     * @param {Function} categoryGetter A function that should return the category of reference (e.g. "textures" or "projectileClasses") for a passed type
     * @returns {Boolean}
     */
    function _changeReference(data, accessor, type, oldName, newName, categoryGetter) {
        var index;
        // if the property is a reference type in the same category as currently selected (e.g. we have a texture selected and the property is a texture reference)
        if ((categoryGetter(type) === _selectedItem.category)) {
            // references are either enums (a simple string reference) or sets (an array of string references)
            switch (type.getBaseType()) {
                case descriptors.BaseType.ENUM:
                    if (data[accessor] === oldName) {
                        data[accessor] = newName;
                        return true;
                    }
                    break;
                case descriptors.BaseType.SET:
                    index = data[accessor].indexOf(oldName);
                    if (index >= 0) {
                        data[accessor][index] = newName;
                        return true;
                    }
                    break;
            }
        }
        return false;
    }
    /**
     * Checks for all references within the passed data using the passed type information, and replaces all references having the passed
     * old name in the same category as currently selected to the passed new name. 
     * E.g. we want to replace texture references to the "explosion" texture to references to the "shard" texture in an explosion class,
     * because we have just renamed the corresponding texture (so we have it selected)
     * See the parameter examples on how to do that.
     * @param {} data The data in which to look for references. Will be interpreted based on the type info to recursively check for references
     * within arrays / objects. E.g. the initialization JSON object for an explosion class
     * @param {Type} type The information describing the type of the passed data. E.g. the EXPLOSION_CLASS item descriptor
     * @param {String} oldName The old name which to replace e.g. "explosion"
     * @param {String} newName The new name which to replace e.g. "shard"
     * @param {Function} categoryGetter Should return the category of reference if a type is passed to it. E.g. passing a texture reference
     * type descriptor to it, should return "textures" if we are looking for resource references (but not if we are looking for class references)
     */
    function _changeReferences(data, type, oldName, newName, categoryGetter) {
        var propertyDescriptors, propertyDescriptorNames, i, childType, keys;
        if (data) {
            switch (type.getBaseType()) {
                case descriptors.BaseType.OBJECT:
                    propertyDescriptors = type.getProperties();
                    propertyDescriptorNames = Object.keys(propertyDescriptors);
                    for (i = 0; i < propertyDescriptorNames.length; i++) {
                        childType = new descriptors.Type(propertyDescriptors[propertyDescriptorNames[i]].type);
                        if (!_changeReference(data, propertyDescriptors[propertyDescriptorNames[i]].name, childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[propertyDescriptors[propertyDescriptorNames[i]].name], childType, oldName, newName, categoryGetter);
                        }
                    }
                    break;
                case descriptors.BaseType.ARRAY:
                    childType = type.getElementType();
                    for (i = 0; i < data.length; i++) {
                        if (!_changeReference(data, i, childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[i], childType, oldName, newName, categoryGetter);
                        }
                    }
                    break;
                case descriptors.BaseType.ASSOCIATIVE_ARRAY:
                    childType = type.getElementType();
                    keys = Object.keys(data);
                    for (i = 0; i < keys.length; i++) {
                        if (!_changeReference(data, keys[i], childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[keys[i]], childType, oldName, newName, categoryGetter);
                        }
                    }
                    break;
                case descriptors.BaseType.PAIRS:
                    for (i = 0; i < data.length; i++) {
                        childType = type.getFirstType();
                        if (!_changeReference(data[i], 0, childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[i][0], childType, oldName, newName, categoryGetter);
                        }
                        childType = type.getSecondType();
                        if (!_changeReference(data[i], 1, childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[i][1], childType, oldName, newName, categoryGetter);
                        }
                    }
                    break;
            }
        }
    }
    /**
     * Creates and returns a function that can be used when the name of an item is changed
     * @param {String} oldName
     * @param {String} newName
     * @param {Function} categoryGetter Should return the reference category of a property if the type info of the property is passed to it,
     * of the same item type as the item that has been changed (resource / class / etc)
     * @returns {Function}
     */
    function _createItemNameChangeHandler(oldName, newName, categoryGetter) {
        return function (itemInstance, categoryName) {
            var descriptor = descriptors.itemDescriptors[categoryName];
            if (descriptor) {
                _changeReferences(itemInstance.getData(), new descriptors.Type(descriptor), oldName, newName, categoryGetter, true);
            }
            itemInstance.reloadData();
        };
    }
    /**
     * A function to execute whenever the name property of the selected item is changed
     * @param {String} newName
     */
    function _handleNameChange(newName) {
        var oldName = _selectedItemElement.innerHTML, nameChangeHandler;
        _selectedItemElement.innerHTML = newName;
        switch (_selectedItem.type) {
            case common.ItemType.RESOURCE:
                resources.renameResource(_selectedItem.category, oldName, newName);
                nameChangeHandler = _createItemNameChangeHandler(oldName, newName, function (type) {
                    return type.getResourceReference();
                });
                break;
            case common.ItemType.CLASS:
                classes.renameClass(_selectedItem.category, oldName, newName);
                nameChangeHandler = _createItemNameChangeHandler(oldName, newName, function (type) {
                    return type.getClassReference();
                });
                break;
            default:
                application.showError("Name change not supported for this type of item!");
                return;
        }
        resources.executeForAllResources(nameChangeHandler);
        classes.executeForAllClasses(nameChangeHandler);
        missions.executeForAllEnvironments(nameChangeHandler);
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
            _clearPreview();
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
     * @param {String} category The category the item belongs to (e.g. "spacecraftClasses")
     * @param {Object} data The data (JSON object) the given item is initialized from
     * @returns {Function}
     */
    function _createElementClickHandler(element, type, category, data) {
        return function () {
            if (_selectedItemElement) {
                _selectedItemElement.classList.remove(SELECTED_CLASS);
            }
            _selectItem(type, element.textContent, category, data);
            _selectedItemElement = element;
            _selectedItemElement.classList.add(SELECTED_CLASS);
        };
    }
    /**
     * Returns a string that can be used as a drag and drop dataTransfer type for items of the passed type and category
     * @param {String} type
     * @param {String} category
     * @returns {String}
     */
    function _getItemDataTransferType(type, category) {
        return (type + "/" + category).toLowerCase();
    }
    /**
     * Creates and returns a handler for the dragstart event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDragStartHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            event.dataTransfer.setData(dataTransferType, element.id);
            element.classList.add(ELEMENT_INSERTING_CLASS);
        };
    }
    /**
     * Creates and returns a handler for the dragend event for item elements (<li> tags)
     * @param {Element} element
     * @returns {Function}
     */
    function _createElementDragEndHandler(element) {
        return function () {
            element.classList.remove(ELEMENT_INSERTING_CLASS);
        };
    }
    /**
     * Creates and returns a handler for the dragenter event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDragEnterHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            var hasCorrectType = event.dataTransfer.types.indexOf(dataTransferType) >= 0;
            if (hasCorrectType && (event.dataTransfer.getData(dataTransferType) !== element.id)) {
                element.classList.add(ELEMENT_DRAGOVER_CLASS);
                event.preventDefault();
            }
        };
    }
    /**
     * Creates and returns a handler for the dragover event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDragOverHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            var hasCorrectType = event.dataTransfer.types.indexOf(dataTransferType) >= 0;
            if (hasCorrectType && (event.dataTransfer.getData(dataTransferType) !== element.id)) {
                event.preventDefault();
            }
        };
    }
    /**
     * Creates and returns a handler for the dragleave event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDragLeaveHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            var hasCorrectType = event.dataTransfer.types.indexOf(dataTransferType) >= 0;
            if (hasCorrectType) {
                element.classList.remove(ELEMENT_DRAGOVER_CLASS);
            }
        };
    }
    /**
     * Creates and returns a handler for the drop event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDropHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            var otherElement = document.getElementById(event.dataTransfer.getData(dataTransferType));
            element.classList.remove(ELEMENT_DRAGOVER_CLASS);
            element.parentNode.insertBefore(otherElement, element.nextSibling);
            switch (type) {
                case common.ItemType.RESOURCE:
                    resources.moveResourceAfter(category, otherElement.firstChild.textContent, element.firstChild.textContent);
                    break;
                case common.ItemType.CLASS:
                    classes.moveClassAfter(category, otherElement.firstChild.textContent, element.firstChild.textContent);
                    break;
                default:
                    application.showError("Cannot move element of type '" + type + "'!");
            }
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
     * Returns the string that can be used as the content of an exported file 
     * @param {String} name The name to be included in the info section of the file
     * @param {String} author The author to be included in the info section of the file
     * @param {String[]} categories The list of the categories to include in the file
     * @param {Function} getNamesFunction The function that returns the names of the items to be included for a given category
     * @param {Function} getItemFunction  The function that returns the data of items to be included, given the category and name of the item
     * @returns {String}
     */
    function _getItemsString(name, author, categories, getNamesFunction, getItemFunction) {
        var i, j, itemNames, result, itemData;
        result = '{"info":' + _getInfoString(name, author);
        for (i = 0; i < categories.length; i++) {
            result += ',"' + categories[i] + '":[';
            itemNames = getNamesFunction(categories[i]);
            for (j = 0; j < itemNames.length; j++) {
                itemData = getItemFunction(categories[i], itemNames[j]).getData();
                if (itemData) {
                    result += ((j > 0) ? ',' : '') + JSON.stringify(itemData);
                }
            }
            result += ']';
        }
        result += "}";
        return result;
    }
    /**
     * Exports the passed string into a JSON file the download of which is then triggered
     * @param {String} name The name of the file (without extension)
     * @param {String} string The string to use as the contents of the file
     */
    function _exportString(name, string) {
        var
                blob = new Blob([string], {type: "text/json"}),
                e = document.createEvent("MouseEvents"),
                a = document.createElement("a");
        a.download = name + ".json";
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ["text/json", a.download, a.href].join(":");
        e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(e);
    }
    /**
     * Sets up the event handlers for the elements in the export dialog
     */
    function _loadExportDialog() {
        var
                exportDialog = document.getElementById(EXPORT_DIALOG_ID),
                exportType = document.getElementById(EXPORT_TYPE_ID),
                exportName = document.getElementById(EXPORT_NAME_ID),
                exportAuthor = document.getElementById(EXPORT_AUTHOR_ID),
                exportExport = document.getElementById(EXPORT_EXPORT_BUTTON_ID),
                exportCancel = document.getElementById(EXPORT_CANCEL_BUTTON_ID);
        common.setSelectorOptions(exportType, [common.ItemType.RESOURCE, common.ItemType.CLASS, common.ItemType.ENVIRONMENT]);
        exportType.onchange = function () {
            exportName.value = exportType.value;
        };
        exportName.value = exportType.value;
        exportExport.onclick = function () {
            switch (exportType.value) {
                case common.ItemType.RESOURCE:
                    _exportString(
                            exportName.value,
                            _getItemsString(
                                    exportName.value,
                                    exportAuthor.value,
                                    resources.getResourceTypes(),
                                    resources.getResourceNames,
                                    resources.getResource));
                    break;
                case common.ItemType.CLASS:
                    _exportString(
                            exportName.value,
                            _getItemsString(
                                    exportName.value,
                                    exportAuthor.value,
                                    classes.getClassCategories(),
                                    classes.getClassNames,
                                    classes.getClass));
                    break;
                case common.ItemType.ENVIRONMENT:
                    _exportString(
                            exportName.value,
                            _getItemsString(
                                    exportName.value,
                                    exportAuthor.value,
                                    [ENVIRONMENTS_CATEGORY],
                                    missions.getEnvironmentNames,
                                    function (categoryName, itemName) {
                                        return (categoryName === ENVIRONMENTS_CATEGORY) ? missions.getEnvironment(itemName) : null;
                                    }));
                    break;
                default:
                    application.showError("Exporting " + exportType.value + " is not yet implemented!");
            }
            exportDialog.hidden = true;
        };
        exportCancel.onclick = function () {
            exportDialog.hidden = true;
        };
    }
    /**
     * Creates and returns a collapsable list (<ul> tag) containing the categories of the game items belonging to the passed type.
     * @param {String} itemType (enum ItemType)
     * @returns {Element}
     */
    function _createCategoryList(itemType) {
        var result = document.createElement("div"),
                itemTypeLabel,
                categories, categoryList, categoryElement, categorySpan,
                items, itemList, itemElement, itemSpan,
                i, j, getItems;
        switch (itemType) {
            case common.ItemType.RESOURCE:
                categories = resources.getResourceTypes();
                getItems = resources.getResourceNames;
                break;
            case common.ItemType.CLASS:
                categories = classes.getClassCategories();
                getItems = classes.getClassNames;
                break;
            case common.ItemType.ENVIRONMENT:
                categories = [ENVIRONMENTS_CATEGORY];
                getItems = missions.getEnvironmentNames;
                break;
            case common.ItemType.MISSION:
                categories = [MISSIONS_CATEGORY];
                getItems = missions.getMissionNames;
                break;
            default:
                application.crash();
        }
        itemTypeLabel = document.createElement("div");
        itemTypeLabel.classList.add(ITEM_TYPE_LABEL_CLASS);
        itemTypeLabel.textContent = itemType;
        result.appendChild(itemTypeLabel);
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
                itemElement.setAttribute("id", ELEMENT_LI_ID_PREFIX + itemType + ID_SEPARATOR + categories[i] + ID_SEPARATOR + items[j]);
                itemElement.classList.add(ELEMENT_CLASS);
                itemElement.draggable = (itemType === common.ItemType.RESOURCE) || (itemType === common.ItemType.CLASS);
                itemSpan = document.createElement("span");
                itemSpan.classList.add(ELEMENT_CLASS);
                itemSpan.innerHTML = items[j];
                itemElement.appendChild(itemSpan);
                itemSpan.onclick = _createElementClickHandler(itemSpan, itemType, categories[i]);
                if (itemElement.draggable) {
                    itemElement.ondragstart = _createElementDragStartHandler(itemElement, itemType, categories[i], itemElement.id);
                    itemElement.ondragend = _createElementDragEndHandler(itemElement);
                    itemElement.ondragenter = _createElementDragEnterHandler(itemElement, itemType, categories[i]);
                    itemElement.ondragover = _createElementDragOverHandler(itemElement, itemType, categories[i]);
                    itemElement.ondragleave = _createElementDragLeaveHandler(itemElement, itemType, categories[i]);
                    itemElement.ondrop = _createElementDropHandler(itemElement, itemType, categories[i]);
                }
                itemList.appendChild(itemElement);
            }
            itemList.hidden = true;
            categoryElement.appendChild(itemList);
            categorySpan.onclick = _toggleList.bind(this, itemList);
            categoryList.appendChild(categoryElement);
        }
        result.appendChild(categoryList);
        return result;
    }
    /**
     * Loads the content of the Items window - collapsable lists of game items of each category. Call after the configuration has been 
     * loaded.
     */
    function _loadItems() {
        var windowContent = document.getElementById(ITEMS_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS);
        _hideLabel(windowContent);

        if (_resourceList) {
            windowContent.removeChild(_resourceList);
        }
        _resourceList = _createCategoryList(common.ItemType.RESOURCE);
        windowContent.appendChild(_resourceList);
        if (_classList) {
            windowContent.removeChild(_classList);
        }
        _classList = _createCategoryList(common.ItemType.CLASS);
        windowContent.appendChild(_classList);
        if (_environmentList) {
            windowContent.removeChild(_environmentList);
        }
        _environmentList = _createCategoryList(common.ItemType.ENVIRONMENT);
        windowContent.appendChild(_environmentList);
        if (_missionList) {
            windowContent.removeChild(_missionList);
        }
        _missionList = _createCategoryList(common.ItemType.MISSION);
        windowContent.appendChild(_missionList);
    }
    /**
     * Loads the default values and sets the change handlers for the contents of the New item dialog
     */
    function _loadNewItemDialog() {
        var
                newItemDialog = document.getElementById(NEW_ITEM_DIALOG_ID),
                newItemType = document.getElementById(NEW_ITEM_TYPE_ID),
                newItemCategory = document.getElementById(NEW_ITEM_CATEGORY_ID),
                newItemBase = document.getElementById(NEW_ITEM_BASE_ID),
                newItemName = document.getElementById(NEW_ITEM_NAME_ID),
                createButton = document.getElementById(NEW_ITEM_CREATE_BUTTON_ID),
                cancelButton = document.getElementById(NEW_ITEM_CANCEL_BUTTON_ID),
                getItems, create;
        common.setSelectorOptions(newItemType, [common.ItemType.RESOURCE, common.ItemType.CLASS, common.ItemType.ENVIRONMENT]);
        newItemType.onchange = function () {
            switch (newItemType.value) {
                case common.ItemType.RESOURCE:
                    common.setSelectorOptions(newItemCategory, resources.getResourceTypes());
                    getItems = resources.getResourceNames;
                    create = function () {
                        var newItemData = ((newItemBase.selectedIndex > 0) ?
                                utils.deepCopy(resources.getResource(newItemCategory.value, newItemBase.value).getData()) :
                                properties.getDefaultItemData(
                                        descriptors.itemDescriptors[newItemCategory.value],
                                        newItemName.value));
                        newItemData.name = newItemName.value;
                        resources.createResource(newItemCategory.value, newItemData);
                    };
                    break;
                case common.ItemType.CLASS:
                    common.setSelectorOptions(newItemCategory, classes.getClassCategories());
                    getItems = classes.getClassNames;
                    create = function () {
                        var newItemData = ((newItemBase.selectedIndex > 0) ?
                                utils.deepCopy(classes.getClass(newItemCategory.value, newItemBase.value).getData()) :
                                properties.getDefaultItemData(
                                        descriptors.itemDescriptors[newItemCategory.value],
                                        newItemName.value));
                        newItemData.name = newItemName.value;
                        classes.createClass(newItemCategory.value, newItemData);
                    };
                    break;
                case common.ItemType.ENVIRONMENT:
                    common.setSelectorOptions(newItemCategory, [ENVIRONMENTS_CATEGORY]);
                    getItems = missions.getEnvironmentNames;
                    create = function () {
                        var newItemData = ((newItemBase.selectedIndex > 0) ?
                                utils.deepCopy(missions.getEnvironment(newItemBase.value).getData()) :
                                properties.getDefaultItemData(
                                        descriptors.itemDescriptors[newItemCategory.value],
                                        newItemName.value));
                        newItemData.name = newItemName.value;
                        missions.createEnvironment(newItemData);
                    };
                    break;
                default:
                    getItems = null;
                    create = null;
                    application.showError("Creating " + newItemType.value + " is not yet implemented!");
            }
            newItemCategory.onchange();
        };
        newItemCategory.onchange = function () {
            if (getItems) {
                common.setSelectorOptions(newItemBase, ["none"].concat(getItems(newItemCategory.value)));
                newItemName.value = newItemCategory.value;
            }
        };
        newItemBase.onchange = function () {
            newItemName.value = newItemBase.value + "_copy";
        };
        newItemType.onchange();
        createButton.onclick = function () {
            var itemNames;
            if (getItems) {
                itemNames = getItems(newItemCategory.value);
                if (itemNames.indexOf(newItemName.value) >= 0) {
                    application.showError("Cannot create item: '" + newItemName.value + "' already exists!", application.ErrorSeverity.MINOR);
                    return;
                }
                if (create) {
                    create();
                    _loadItems();
                    newItemDialog.hidden = true;
                }
            }
        };
        cancelButton.onclick = function () {
            newItemDialog.hidden = true;
        };
    }
    /**
     * Sets up the content for all dialogs
     */
    function _loadDialogs() {
        var
                newItemDialog = document.getElementById(NEW_ITEM_DIALOG_ID),
                exportDialog = document.getElementById(EXPORT_DIALOG_ID);
        document.getElementById(NEW_ITEM_BUTTON_ID).onclick = function () {
            newItemDialog.hidden = !newItemDialog.hidden;
        };
        _loadNewItemDialog();

        document.getElementById(EXPORT_BUTTON_ID).onclick = function () {
            exportDialog.hidden = !exportDialog.hidden;
        };
        _loadExportDialog();
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
                missions.requestLoad();
                missions.executeWhenReady(function () {
                    application.log("Game settings loaded.", 1);
                    localStorage[constants.VERSION_LOCAL_STORAGE_ID] = application.getVersion();
                    application.log("Initialization completed.");
                    _setLabel(document.getElementById(PREVIEW_WINDOW_ID), NO_ITEM_SELECTED_TEXT);
                    _setLabel(document.getElementById(PROPERTIES_WINDOW_ID), NO_ITEM_SELECTED_TEXT);
                    _loadItems();
                    _loadDialogs();
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
    /**
     * The function to handle the window resize event
     * @returns {}
     */
    function _handleResize() {
        common.alignPopups();
    }
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        initialize: function () {
            application.setPreviouslyRunVersion(localStorage[constants.VERSION_LOCAL_STORAGE_ID]);
            _requestConfigLoad();
            window.addEventListener("resize", _handleResize);
        }
    };
});
