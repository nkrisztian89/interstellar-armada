/**
 * Copyright 2016-2017, 2019-2023 Krisztián Nagy
 * @file Provides the content and event handlers for the Properties window of the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for enum handling
 * @param application Used for showing errors
 * @param config Used to obtain configuration settings
 * @param descriptors Used to obtain the appropriate properties description object
 * @param common Used to create selectors
 */
define([
    "utils/utils",
    "modules/application",
    "armada/configuration",
    "editor/descriptors",
    "editor/common"
], function (utils, application, config, descriptors, common) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Constants
            PROPERTIES_CLASS = "propertiesTable",
            PROPERTY_ROW_CLASS = "property",
            UNSET_PROPERTY_ROW_CLASS = "unset",
            PROPERTY_CLASS = "propertyName",
            CONTROL_CLASS = "propertyControl",
            PROPERTY_EDITOR_HEADER_CLASS = "propertyEditorHeader",
            PROPERTY_EDITOR_HEADER_BUTTON_CLASS = "propertyEditorHeaderButton",
            SET_PROPERTY_BUTTON_CLASS = "setProperty",
            UNSET_PROPERTY_BUTTON_CLASS = "unsetProperty",
            JUMP_TO_REFERENCE_BUTTON_CLASS = "jumpReference",
            TEXT_AREA_ROWS = 5,
            TEXT_AREA_COLS = 100,
            LONG_TEXT_PREVIEW_LENGTH = 16,
            EMPTY_LIST_TEXT = "empty list",
            INHERITED_PROPERTY_TEXT = "inherited",
            DEFAULT_PROPERTY_TEXT = "default",
            UNSET_PROPERTY_TEXT = "not set",
            NONE_PROPERTY_TEXT = "none",
            UNKNOWN_PROPERTY_TEXT = "unknown",
            SET_PROPERTY_BUTTON_CAPTION = "set",
            UNSET_PROPERTY_BUTTON_CAPTION = "x",
            UNSET_PROPERTY_BUTTON_TOOLTIP = "Unset property",
            WITH_SET_PROPERTY_BUTTON_CLASS = "withSetButton",
            WITH_UNSET_PROPERTY_BUTTON_CLASS = "withUnsetButton",
            JUMP_TO_REFERENCE_BUTTON_CAPTION = "↷",
            JUMP_TO_REFERENCE_BUTTON_TOOLTIP = "Jump to referenced item",
            WITH_JUMP_TO_REFERENCE_BUTTON_CLASS = "withJumpButton",
            ADD_BUTTON_CLASS = "add icon",
            ADD_BUTTON_TOOLTIP = "Add a new {element} with default values",
            DUPLICATE_BUTTON_CLASS = "copy icon",
            DUPLICATE_BUTTON_TOOLTIP = "Duplicate this {element}",
            MOVE_UP_BUTTON_CLASS = "up icon",
            MOVE_UP_BUTTON_TOOLTIP = "Move this {element} up in the list",
            MOVE_DOWN_BUTTON_CLASS = "down icon",
            MOVE_DOWN_BUTTON_TOOLTIP = "Move this {element} down in the list",
            REMOVE_BUTTON_CLASS = "delete icon",
            REMOVE_BUTTON_TOOLTIP = "Delete this {element}",
            PROPERTY_EDIT_BUTTON_TOOLTIP = "Toggle editing {property}",
            NEW_OBJECT_NAME_PREFIX = "new",
            DUPLICATE_ELEMENT_SUFFIX = "_copy",
            // ------------------------------------------------------------------------------
            // Private variables
            /**
             * A reference to the element within which the property editor controls are created
             * @type Element
             */
            _element,
            /**
             * A reference to the selected item the properties of which are displayed
             * @type Editor~Item
             */
            _item,
            /**
             * A reference to the resource / class that the selected item is based on (references)
             * @type GenericResource|GenericClass
             */
            _basedOn,
            /**
             * The module providing the Preview for the item the properties of which are displayed
             * @type Editor~Preview
             */
            _preview,
            /**
             * A reference to the function to execute whenever the name property of the selected item is changed
             * @type Function
             */
            _nameChangeHandler,
            /**
             * A reference to the function to execute to select another item (for jumping to referenced items) in the editor
             * @type Function
             */
            _selectItemFunction,
            /**
             * Stores the callback functions to be called to edit the properties of the current item. The keys are the property
             * names, and the values are the callbacks, taking one parameter for the index of the element for array properties.
             * E.g. calling _editCallbacks["spacecrafts"](2) would set the editing of the spacecrafts[2] element. Passing -1 as
             * index indicates to stop editing that property.
             * @type Object
             */
            _editCallbacks,
            // ------------------------------------------------------------------------------
            // Private functions
            _createControl, _createProperties, createProperties;
    /**
     * Updates the reference to the base of the displayed item 
     * @returns {Boolean} Whether the reference has been changed
     */
    function _updateBasedOn() {
        var newBasedOn = _item.data[descriptors.BASED_ON_PROPERTY_NAME] ?
                common.getItemReference({type: _item.type, category: _item.category, name: _item.data[descriptors.BASED_ON_PROPERTY_NAME]}) :
                null;
        if (newBasedOn !== _basedOn) {
            _basedOn = newBasedOn;
            return true;
        }
        return false;
    }
    /**
     * Reinitializes the item the properties of which are edited, and notifies the preview module of the change
     * @param {String} name The name of the property that changed
     */
    function _updateData(name) {
        var references, i;
        _item.reference.reloadData();
        // we need to reload the items that are based on the modified item
        references = common.getItemReferencesOfSameCategory(_item);
        for (i = 0; i < references.length; i++) {
            if (references[i].getData()[descriptors.BASED_ON_PROPERTY_NAME] === _item.data[descriptors.NAME_PROPERTY_NAME]) {
                references[i].reloadData();
            }
        }
        // if we changed the basedon property, refresh the property editors, as all inherited properties might change
        if (_updateBasedOn()) {
            _element.innerHTML = "";
            createProperties(_element, _item, _preview, _nameChangeHandler);
        }
        // signal the preview about the change
        if (_preview) {
            _preview.handleDataChanged(name);
        }
    }
    /**
     * Changes the property with the given name (key) in the data object, and notifies the preview module of the change
     * @param {String} topName The name (key) of the property of the edited item which changed / under which the change happened 
     * @param {} value The new value the property is to be changed to
     * @param {Object|Array} [parent] If the changed property belongs to an object or array below the main item, a reference to that object 
     * or array needs to be  given here
     * @param {String|Number} [name] If the changed property belongs to an object or array below the main item, the name of the property or
     * in case of array the index of the element needs to be given
     * here (topName refers to the name of the property under which the change happened. In case of changing 
     * selectedSpacecraftClass.loadouts[1].weapons[0].class, topName would be "loadouts" and name would be "class"
     * (and parent should refer to weapons[0]))
     * @param {Function} callback Function to execute after the data object has been changed but before the game objects have been reloaded from the new data
     */
    function _changeData(topName, value, parent, name, callback) {
        if (parent) {
            parent[name] = value;
        } else {
            _item.data[topName] = value;
        }
        if (callback) {
            callback(value);
        }
        _updateData(topName);
    }
    /**
     * Creates and returns a control that can be used to edit boolean properties.
     * @param {String} topName Name of the top property being edited
     * @param {Boolean} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @param {Function} [onChange] A function to execute every time after the value of the boolean was changed using this control
     * @returns {Element}
     */
    function _createBooleanControl(topName, data, parent, name, onChange) {
        var result = common.createBooleanInput(data, function (value) {
            _changeData(topName, value, parent, name, onChange);
        });
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit string properties.
     * @param {String} topName Name of the top property being edited
     * @param {String} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @param {String[]} [suggestions] A list of text suggestions to show for the user
     * @param {Function} [onChange] A function to execute every time after the value of the string was changed using this control
     * @returns {Element}
     */
    function _createStringControl(topName, data, parent, name, suggestions, onChange) {
        var datalist, option, id, i, result = document.createElement("input");
        result.type = "text";
        result.className = common.STRING_INPUT_CLASS;
        result.value = data;
        result.onchange = function () {
            _changeData(topName, result.value, parent, name, onChange);
        };
        if (suggestions) {
            id = "dl-" + topName + "-" + name;
            datalist = document.getElementById(id);
            if (datalist) {
                datalist.innerHTML = "";
            } else {
                datalist = document.createElement("datalist");
                datalist.id = id;
            }
            for (i = 0; i < suggestions.length; i++) {
                option = document.createElement("option");
                option.value = suggestions[i];
                option.textContent = suggestions[i];
                datalist.appendChild(option);
            }
            document.body.appendChild(datalist);
            result.setAttribute("list", id);
        }
        return result;
    }
    /**
     * Creates and returns a popup preconfigured to notify the preview window about the editing of the top level property it belongs to,
     * in case it is top level
     * @param {Element} invoker The invoker of the popup (see Popup)
     * @param {Popup} [parentPopup] If this popup is to be a child of another one, give the parent here
     * @param {String} topName The name of the top level property this popup belongs to
     * @param {Function} [showHandler] A function to be executed next to to notifying the preview whenever the popup is shown
     * @param {Function} [hideHandler] A function to be executed next to to notifying the preview whenever the popup is hidden
     * @returns {Popup}
     */
    function _createPopup(invoker, parentPopup, topName, showHandler, hideHandler) {
        return new common.Popup(invoker, parentPopup, {
            show: function () {
                if (_preview && !parentPopup) {
                    _preview.handleStartEdit(topName, 0);
                }
                if (showHandler) {
                    showHandler();
                }
            },
            hide: function () {
                if (_preview && !parentPopup) {
                    _preview.handleStopEdit(topName);
                }
                if (hideHandler) {
                    hideHandler();
                }
            },
            removeHide: function () {
                if (_preview && !parentPopup) {
                    _preview.handleStopEdit(topName);
                }
            }
        });
    }
    /**
     * Returns a short, preview excerpt from a longer text to show
     * @param {String} string The original (potentially) long text
     * @returns {String}
     */
    function _getStringPreview(string) {
        return (string.length > 0) ? (string.substr(0, LONG_TEXT_PREVIEW_LENGTH) + ((string.length > LONG_TEXT_PREVIEW_LENGTH) ? "..." : "")) : "...";
    }
    /**
     * Creates and returns a control that can be used to edit long string properties.
     * @param {String} topName Name of the top property being edited
     * @param {String} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @param {Popup} [parentPopup] If this object property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} [onChange] A function to execute every time after the value of the string was changed using this control
     * @returns {Element}
     */
    function _createLongStringControl(topName, data, parent, name, parentPopup, onChange) {
        var
                textarea = document.createElement("textarea"),
                button, popup;
        button = common.createButton(_getStringPreview(data), function () {
            popup.toggle();
        });
        popup = _createPopup(button, parentPopup, topName, null, function () {
            _changeData(topName, textarea.value, parent, name, onChange);
            button.textContent = _getStringPreview(textarea.value);
            if (parentPopup) {
                parentPopup.alignPosition();
            }
        });
        textarea.value = data;
        textarea.cols = TEXT_AREA_COLS;
        textarea.rows = TEXT_AREA_ROWS;
        textarea.spellcheck = false;
        textarea.autocomplete = "off";
        textarea.autocorrect = "off";
        textarea.autocapitalize = "off";
        popup.getElement().appendChild(textarea);
        popup.addToPage();
        button.popup = popup; // custom property referencing the popup
        return button;
    }
    /**
     * @callback NumberControl~changeHandler
     * @param {Element} element The HTML element representing the control the value of which was changed
     */
    /**
     * Creates and returns a control that can be used to edit numeric properties.
     * @param {String} topName Name of the top property being edited
     * @param {Number} data The starting value
     * @param {Boolean} integer If true, only integer values are allowed (otherwise floats as well)
     * @param {NumberControl~changeHandler} [changeHandler] The function that should be run on the change event of the control, after 
     * checking the value to be a number
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @param {String} [unit] The unit of measurement using which the number is to be interpreted 
     * @param {Number} [min] The minimum allowed value for this number
     * @param {Number} [max] The minimum allowed value for this number
     * @returns {Element}
     */
    function _createNumberControl(topName, data, integer, changeHandler, parent, name, unit, min, max) {
        var result = document.createElement("div"),
                input = common.createNumericInput(data, {integer: integer, min: min, max: max}, function (value) {
                    _changeData(topName, value, parent, name, changeHandler);
                });
        result.appendChild(input);
        if (unit) {
            result.appendChild(common.createLabel(unit));
        }
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit enum properties.
     * @param {String} topName Name of the top property being edited
     * @param {String[]} values The list of possible values
     * @param {String} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @param {Function} [onchange]
     * @returns {Element}
     */
    function _createEnumControl(topName, values, data, parent, name, onchange) {
        var result = common.createSelector(values, data, false, function (value) {
            _changeData(topName, result ? result.value : value, parent, name, onchange);
        });
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit color properties.
     * @param {String} name Name of the property to edit
     * @param {Number[4]} data The reference to the property to edit
     * @returns {Element}
     */
    function _createColorControl(name, data) {
        return common.createColorPicker(data, function () {
            _updateData(name);
        });
    }
    /**
     * Creates and returns a control that can be used to edit numeric vector properties.
     * @param {String} name Name of the property to edit
     * @param {Number[]} data The reference to the property to edit
     * @returns {Element}
     */
    function _createVectorControl(name, data) {
        return common.createVectorEditor(data, function () {
            _updateData(name);
        });
    }
    /**
     * Creates and returns a control that can be used to edit numeric range properties.
     * @param {String} name Name of the property to edit
     * @param {Editor~TypeDescriptor} typeDescriptor
     * @param {Number[2]} data The reference to the property to edit
     * @returns {Element}
     */
    function _createRangeControl(name, typeDescriptor, data) {
        if ((typeof typeDescriptor) !== "object") {
            typeDescriptor = {};
        }
        return common.createRangeEditor(data, typeDescriptor, function () {
            _updateData(name);
        });
    }
    /**
     * Returns the appropriate default value for the property described by the passed descriptor object
     * @param {Editor~PropertyDescriptor} propertyDescriptor
     * @param {GenericResource|GenericClass} basedOn If the resource / class the property of which is considered has a reference to
     * another object as a base (inheriting undefined properties from it), that base resource / class needs to be given here
     * @param {Object} parent The object itself the data of which is considered (see _changeData)
     * @param {Object} grandParent The parent of the object the data of which is considered
     * @param {Object} topParent The top level object we are editing
     * @param {Boolean} [undefinedIfOptionalWithNoDefault=false] If true, the function will return undefined for properties marked as optional which do
     * not have a default value set
     * @param {Boolean} [undefinedIfOptionalOrHasDefault=false] If true, the function will return undefined for properties marked as optional OR has a default value
     * @param {String} [typeName] The name of the type of the object this property is part of
     * @param {Number} [arrayIndex] If this value is created for an element an array, this should be the index of the element
     * @param {Number} [propertyOfArrayElement=false] If this value is created for a property of an object that is an element in the array, this should be true
     * @returns {}
     */
    function _getDefaultValue(propertyDescriptor, basedOn, parent, grandParent, topParent, undefinedIfOptionalWithNoDefault, undefinedIfOptionalOrHasDefault, typeName, arrayIndex, propertyOfArrayElement) {
        var result, type, propertyDescriptors, propertyDescriptorNames, i, optional, count;
        type = new descriptors.Type(propertyDescriptor.type);
        optional = propertyDescriptor.optional || (propertyDescriptor.isRequired && !propertyDescriptor.isRequired(parent, grandParent, _item.name));
        // automatic naming - only for string type name properties (can be enum as well)
        if ((propertyDescriptor.name === descriptors.NAME_PROPERTY_NAME) && typeName && (type.getBaseType() === descriptors.BaseType.STRING)) {
            if (arrayIndex !== undefined) {
                return typeName + " " + (arrayIndex + 1).toString();
            }
            return NEW_OBJECT_NAME_PREFIX + typeName;
        }
        if ((undefinedIfOptionalWithNoDefault && optional && (propertyDescriptor.defaultValue === undefined) && (propertyDescriptor.getDerivedDefault === undefined)) ||
                (undefinedIfOptionalOrHasDefault && (optional || (propertyDescriptor.defaultValue !== undefined) || (propertyDescriptor.getDerivedDefault !== undefined)))) {
            return undefined;
        }
        if (basedOn) {
            result = utils.deepCopy(basedOn.getData()[propertyDescriptor.name]);
            if (result === undefined) {
                return _getDefaultValue(
                        propertyDescriptor,
                        (basedOn.getData()[descriptors.BASED_ON_PROPERTY_NAME] ?
                                common.getItemReference({type: _item.type, category: _item.category, name: basedOn.getData()[descriptors.BASED_ON_PROPERTY_NAME]}) :
                                null),
                        null, null, topParent, undefinedIfOptionalWithNoDefault, undefinedIfOptionalOrHasDefault);
            }
            return result;
        }
        if (propertyDescriptor.newValue) {
            return utils.deepCopy(propertyDescriptor.newValue);
        }
        if (propertyDescriptor.defaultValue) {
            return utils.deepCopy(propertyDescriptor.defaultValue);
        }
        switch (type.getBaseType()) {
            case descriptors.BaseType.BOOLEAN:
                return false;
            case descriptors.BaseType.NUMBER:
                return (type.getMin() !== undefined) ? Math.max(type.getMin(), 0) : 0;
            case descriptors.BaseType.STRING:
                return "";
            case descriptors.BaseType.ARRAY:
                result = [];
                count = 0;
                if (type.getFixedLength()) {
                    count = type.getFixedLength();
                } else if (type.getMinLength()) {
                    count = type.getMinLength();
                }
                while (count > 0) {
                    result.push(_getDefaultValue(
                            {type: propertyDescriptor.type.elementType},
                            null,
                            result,
                            parent,
                            topParent,
                            true));
                    count--;
                }
                return result;
            case descriptors.BaseType.PAIRS:
            case descriptors.BaseType.ROTATIONS:
            case descriptors.BaseType.SET:
                return [];
            case descriptors.BaseType.OBJECT:
                result = {};
                propertyDescriptors = type.getProperties();
                propertyDescriptorNames = Object.keys(propertyDescriptors);
                for (i = 0; i < propertyDescriptorNames.length; i++) {
                    result[propertyDescriptors[propertyDescriptorNames[i]].name] = _getDefaultValue(
                            propertyDescriptors[propertyDescriptorNames[i]],
                            null,
                            result,
                            parent,
                            topParent,
                            true,
                            true,
                            type.getName(),
                            propertyOfArrayElement ? undefined : arrayIndex,
                            (arrayIndex !== undefined));
                }
                return result;
            case descriptors.BaseType.ENUM:
                return descriptors.getPropertyValues(propertyDescriptor, parent, topParent, _item ? _item.name : null)[0];
            case descriptors.BaseType.COLOR3:
            case descriptors.BaseType.VECTOR3:
                return [0, 0, 0];
            case descriptors.BaseType.COLOR4:
                return [0, 0, 0, 1];
            case descriptors.BaseType.RANGE:
                return [0, 0];
            case descriptors.BaseType.CONFINES:
                return [[0, 0], [0, 0], [0, 0]];
            case descriptors.BaseType.ASSOCIATIVE_ARRAY:
                return {};
        }
        document.crash();
    }
    /**
     * Creates a JSON object for items described by the passed item descriptor, with all properties (except for the name property) will
     * be set to default values
     * @param {Editor~ItemDescriptor} itemDescriptor
     * @param {String} name The value to set for the name property in the created object
     * @param {String} type (enum ItemType) The type of the item to create data for
     * @param {String} category The category of the item to create the data for
     * @returns {Object}
     */
    function getDefaultItemData(itemDescriptor, name, type, category) {
        var result = {}, i, propertyDescriptor, propertyDescriptorNames = Object.keys(itemDescriptor);
        _item = {
            type: type,
            name: name,
            category: category,
            reference: null,
            data: null
        };
        for (i = 0; i < propertyDescriptorNames.length; i++) {
            propertyDescriptor = itemDescriptor[propertyDescriptorNames[i]];
            if (propertyDescriptor.name === descriptors.NAME_PROPERTY_NAME) {
                result[propertyDescriptor.name] = name;
            } else {
                result[propertyDescriptor.name] = _getDefaultValue(propertyDescriptor, null, result, null, null, true, true);
            }
        }
        return result;
    }
    /**
     * Adds a header (div element) to the element representing the passed Popup with the appropriate CSS class,
     * containing the element and buttons passed. The buttons also get the appropriate CSS class.
     * @param {Popup} popup
     * @param {Element[]} elements
     * @param {Element[]} buttons
     */
    function _addPropertyEditorHeader(popup, elements, buttons) {
        var i, result = document.createElement("div");
        result.classList.add(PROPERTY_EDITOR_HEADER_CLASS);
        for (i = 0; i < elements.length; i++) {
            result.appendChild(elements[i]);
        }
        for (i = 0; i < buttons.length; i++) {
            buttons[i].classList.add(PROPERTY_EDITOR_HEADER_BUTTON_CLASS);
            result.appendChild(buttons[i]);
        }
        result.onmousedown = function (event) {
            var passedEvent;
            if ((event.target.tagName === "DIV") || (event.target.tagName === "SPAN")) {
                passedEvent = new MouseEvent("mousedown", {screenX: event.screenX, screenY: event.screenY});
                popup.getElement().dispatchEvent(passedEvent);
            }
        };
        popup.getElement().appendChild(result);
    }
    /**
     * Creates and returns a control that can be used to edit object properties. (by opening a popup to edit the properties of that object)
     * Can create editors for arrays of objects (of the same type)
     * @param {String} topName Name of the top property being edited (under which this object resides)
     * @param {String} propertyName Name of the property that is being directly edited
     * @param {Editor~TypeDescriptor} typeDescriptor The descriptor object, with BaseType.OBJECT basetype, that describes the properties
     * @param {Object|Array} data The data itself to be modified (an instance of the object the type of which is described, or an array of
     * such objects)
     * @param {Object} parent The parent of data
     * @param {Object} topParent The top level object we are editing
     * @param {Popup} [parentPopup] If this object property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} changeHandler 
     * @param {Type} [arrayType] For object arrays: The type object created from the type descriptor of the array
     * @returns {Element}
     */
    function _createObjectControl(topName, propertyName, typeDescriptor, data, parent, topParent, parentPopup, changeHandler, arrayType) {
        var
                i, button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                isArray = (data instanceof Array),
                type = new descriptors.Type(typeDescriptor),
                indices, indexLabel, indexSelector, color,
                addElementButton, removeElementButton, moveUpElementButton, moveDownElementButton, duplicateElementButton,
                propertiesTable, getIndexText, getIndexColor, addPropertiesTable, indexChangeHandler, updateButtonText, refreshIndices, update,
                updateIndex,
                minCount = (arrayType ? arrayType.getMinLength() || 0 : 0),
                maxCount = (arrayType ? arrayType.getMaxLength() || 0 : 0);
        getIndexText = function (index) {
            var instanceName = ((index >= 0) && data[index]) ? type.getInstanceName(data[index]) : "";
            return (index + 1).toString() + (instanceName ? ": " + instanceName : "");
        };
        getIndexColor = function (index) {
            return ((index >= 0) && data[index]) ? type.getInstanceColor(data[index]) : undefined;
        };
        refreshIndices = function () {
            return common.setSelectorOptions(indexSelector, data.map(function (entry, index) {
                color = getIndexColor(index);
                return color ? {
                    value: getIndexText(index),
                    color: color
                } : getIndexText(index);
            }));
        };
        updateIndex = function (index) {
            indexSelector.options[index].text = getIndexText(index);
            indexSelector.options[index].style.color = getIndexColor(index) || "inherit";
        };
        addPropertiesTable = function (index) {
            propertiesTable = _createProperties(popup.getElement(), (index === undefined) ? data : data[index], typeDescriptor.properties, topName, parent, topParent, popup, update);
        };
        indexChangeHandler = function () {
            var index = indexSelector.selectedIndex;
            popup.hideChildren();
            if (propertiesTable) {
                popup.getElement().removeChild(propertiesTable);
                propertiesTable = null;
            }
            if (index >= 0) {
                if (_preview && !parentPopup) {
                    _preview.handleStartEdit(topName, index);
                }
                addPropertiesTable(index);
                indexLabel.textContent = typeDescriptor.name;
                indexSelector.hidden = false;
                addElementButton.hidden = !!maxCount && (data.length >= maxCount);
                removeElementButton.hidden = (data.length <= minCount);
                duplicateElementButton.hidden = false;
                moveUpElementButton.hidden = (data.length < 2) || (index === 0);
                moveDownElementButton.hidden = (data.length < 2) || (index === (data.length - 1));
            } else {
                indexLabel.textContent = EMPTY_LIST_TEXT;
                indexSelector.hidden = true;
                addElementButton.hidden = false;
                removeElementButton.hidden = true;
                duplicateElementButton.hidden = true;
                moveUpElementButton.hidden = true;
                moveDownElementButton.hidden = true;
            }
            popup.alignPosition();
        };
        updateButtonText = function () {
            button.textContent = (arrayType ? arrayType.getPreviewText(data, parent) : type.getPreviewText(data, parent)) || "...";
            if (parentPopup) {
                parentPopup.alignPosition();
            }
        };
        update = function () {
            updateButtonText();
            if (indexSelector && (indexSelector.selectedIndex >= 0)) {
                updateIndex(indexSelector.selectedIndex);
            }
            if (changeHandler) {
                changeHandler();
            }
        };
        // for arrays: adding a selector at the top of the popup, using which the instance to modify within the array can be selected
        if (isArray) {
            // some objecs have a string shorthand: if the data contains the shorthand, extract it to the full object so it can be edited as usual
            // (only supported for arrays for now)
            if (typeDescriptor.unpack) {
                for (i = 0; i < data.length; i++) {
                    if ((typeof data[i]) === "string") {
                        data[i] = typeDescriptor.unpack(data[i]);
                    }
                }
            }
            // if the array elements have a "name" property, use the values of that instead of indices for selection
            indices = [];
            while (indices.length < data.length) {
                color = getIndexColor(indices.length);
                indices.push(color ? {
                    value: getIndexText(indices.length),
                    color: color
                } : getIndexText(indices.length));
            }
            indexLabel = common.createLabel((data.length > 0) ? typeDescriptor.name : EMPTY_LIST_TEXT);
            indexSelector = common.createSelector(indices, indices[0], false, indexChangeHandler);
            addElementButton = common.createButton({class: ADD_BUTTON_CLASS}, function () {
                var newIndex;
                data.push(_getDefaultValue({type: typeDescriptor}, null, null, null, topParent, true, undefined, undefined, data.length));
                newIndex = document.createElement("option");
                newIndex.value = getIndexText(data.length - 1);
                newIndex.text = newIndex.value;
                newIndex.style.color = getIndexColor(data.length - 1);
                indexSelector.add(newIndex);
                _updateData(topName);
                indexSelector.selectedIndex = data.length - 1;
                update();
                indexChangeHandler();
            }, utils.formatString(ADD_BUTTON_TOOLTIP, {element: typeDescriptor.name}));
            removeElementButton = common.createButton({class: REMOVE_BUTTON_CLASS}, function () {
                if (_preview && !parentPopup) {
                    _preview.handleStopEdit(topName);
                }
                data.splice(indexSelector.selectedIndex, 1);
                _updateData(topName);
                refreshIndices();
                update();
                indexChangeHandler();
            }, utils.formatString(REMOVE_BUTTON_TOOLTIP, {element: typeDescriptor.name}));
            duplicateElementButton = common.createButton({class: DUPLICATE_BUTTON_CLASS}, function () {
                var newIndex;
                data.push(utils.deepCopy(data[indexSelector.selectedIndex]));
                if (type.hasNameProperty() && data[data.length - 1][descriptors.NAME_PROPERTY_NAME]) {
                    data[data.length - 1][descriptors.NAME_PROPERTY_NAME] += DUPLICATE_ELEMENT_SUFFIX;
                }
                newIndex = document.createElement("option");
                newIndex.value = getIndexText(data.length - 1);
                newIndex.text = newIndex.value;
                newIndex.style.color = getIndexColor(data.length - 1);
                indexSelector.add(newIndex);
                _updateData(topName);
                indexSelector.selectedIndex = data.length - 1;
                update();
                indexChangeHandler();
            }, utils.formatString(DUPLICATE_BUTTON_TOOLTIP, {element: typeDescriptor.name}));
            moveUpElementButton = common.createButton({class: MOVE_UP_BUTTON_CLASS}, function () {
                data.splice(indexSelector.selectedIndex - 1, 2, data[indexSelector.selectedIndex], data[indexSelector.selectedIndex - 1]);
                updateButtonText();
                _updateData(topName);
                updateIndex(indexSelector.selectedIndex);
                updateIndex(indexSelector.selectedIndex - 1);
                indexSelector.selectedIndex -= 1;
                indexChangeHandler();
            }, utils.formatString(MOVE_UP_BUTTON_TOOLTIP, {element: typeDescriptor.name}));
            moveDownElementButton = common.createButton({class: MOVE_DOWN_BUTTON_CLASS}, function () {
                data.splice(indexSelector.selectedIndex, 2, data[indexSelector.selectedIndex + 1], data[indexSelector.selectedIndex]);
                updateButtonText();
                _updateData(topName);
                updateIndex(indexSelector.selectedIndex);
                updateIndex(indexSelector.selectedIndex + 1);
                indexSelector.selectedIndex += 1;
                indexChangeHandler();
            }, utils.formatString(MOVE_DOWN_BUTTON_TOOLTIP, {element: typeDescriptor.name}));
            _addPropertyEditorHeader(popup, [indexLabel, indexSelector], (arrayType && arrayType.getFixedLength()) ?
                    [moveUpElementButton, moveDownElementButton] :
                    [addElementButton, duplicateElementButton, moveUpElementButton, moveDownElementButton, removeElementButton]);
            if (data.length > 0) {
                addPropertiesTable(0);
            } else {
                indexSelector.hidden = true;
                moveUpElementButton.hidden = true;
                moveDownElementButton.hidden = true;
                removeElementButton.hidden = true;
            }
        } else {
            addPropertiesTable();
        }
        popup.addToPage();
        // create a button using which the popup can be opened
        button.type = "button";
        updateButtonText();
        // this can be called (through _editCallbacks) to start editing this property programmatically
        button.edit = function (index) {
            if (index === undefined) {
                popup.toggle();
            } else if (index < 0) {
                popup.hide();
            } else {
                popup.show();
            }
            if (isArray && ((index === undefined) || (index !== indexSelector.selectedIndex))) {
                indexSelector.selectedIndex = index || 0;
                if (popup.isVisible()) {
                    indexChangeHandler();
                }
            }
            updateButtonText();
        };
        button.onclick = function () {
            button.edit();
        };
        button.popup = popup; // custom property referencing the popup
        button.title = utils.formatString(PROPERTY_EDIT_BUTTON_TOOLTIP, {property: propertyName});
        return button;
    }
    /**
     * Adds a new row at the bottom of the passed table that has one cell for each of the elements in the passed
     * array, housing the element itself
     * @param {Element} table A HTML table element
     * @param {Element[]} elements The list of elements for the row contain. Can contain null / undefined (falsy) 
     * elements, which will be simply skipped
     */
    function _addRow(table, elements) {
        var row, cell, i;
        row = document.createElement("tr");
        for (i = 0; i < elements.length; i++) {
            if (elements[i]) {
                cell = document.createElement("td");
                cell.appendChild(elements[i]);
                row.appendChild(cell);
            }
        }
        table.appendChild(row);
    }
    /**
     * Sets up the passed button element to toggle the passed popup on click.
     * @param {Element} button A HTML button element
     * @param {String} caption The caption to show on the button (innerHTML)
     * @param {Popup} popup The popup the button should toggle
     */
    function _setPopupTogglerButton(button, caption, popup) {
        button.type = "button";
        button.innerHTML = caption;
        button.onclick = function () {
            popup.toggle();
        };
    }
    /**
     * Creates and returns a control that can be used to edit array properties. (by opening a popup to edit the elements of that array)
     * @param {String} topName Name of the top property being edited (under which this array resides)
     * @param {Editor~TypeDescriptor} elementTypeDescriptor The descriptor object describing the type of the elements of the array
     * @param {Array} array The array itself that the control should edit
     * @param {Array} parent The parent object that houses the array
     * @param {Object} topParent The top level object we are editing
     * @param {Popup} [parentPopup] If this array property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} [changeHandler]
     * @param {Type} [arrayType] The type object created from the type descriptor of the array
     * @returns {Element}
     */
    function _createArrayControl(topName, elementTypeDescriptor, array, parent, topParent, parentPopup, changeHandler, arrayType) {
        var
                type = new descriptors.Type(elementTypeDescriptor),
                minCount = arrayType.getMinLength() || 0,
                maxCount = arrayType.getMaxLength() || 0,
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                label, table, addElementButton, i,
                updateLabel = function () {
                    label.textContent = (array.length > 0) ? type.getDisplayName() + " list" : EMPTY_LIST_TEXT;
                },
                updateButtonText = function () {
                    button.innerHTML = arrayType.getPreviewText(array, parent) || "...";
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                },
                elementChangeHandler = function () {
                    updateButtonText();
                    if (changeHandler) {
                        changeHandler();
                    }
                },
                refreshTable,
                addElementEditor = function (index) {
                    var elements = [
                        common.createLabel((index + 1).toString()),
                        _createControl({name: index, type: elementTypeDescriptor}, array[index], topName, array, parent, null, topParent, parentPopup, elementChangeHandler)
                    ];
                    if ((minCount === 0) || (array.length > minCount)) {
                        elements.push(common.createButton({class: REMOVE_BUTTON_CLASS}, function () {
                            array.splice(index, 1);
                            updateLabel();
                            refreshTable();
                            popup.alignPosition();
                            _updateData(topName);
                            elementChangeHandler();
                        }));
                    }
                    _addRow(table, elements);
                };
        refreshTable = function () {
            table.innerHTML = "";
            for (i = 0; i < array.length; i++) {
                addElementEditor(i);
            }
            addElementButton.hidden = (maxCount > 0) && (array.length >= maxCount);
        };
        addElementButton = common.createButton({class: ADD_BUTTON_CLASS}, function () {
            array.push(_getDefaultValue({type: elementTypeDescriptor}, null, parent, null, topParent, true));
            updateLabel();
            refreshTable();
            popup.alignPosition();
            _updateData(topName);
            elementChangeHandler();
        });
        label = common.createLabel();
        updateLabel();
        _addPropertyEditorHeader(popup, [label], [addElementButton]);
        table = document.createElement("table");
        refreshTable();
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        _setPopupTogglerButton(button, "", popup);
        updateButtonText();
        button.popup = popup; // custom property referencing the popup
        return button;
    }
    /**
     * Creates and returns a control that can be used to edit set properties. (by opening a popup to toggle the elements of that set)
     * @param {String} topName Name of the top property being edited (under which this array resides)
     * @param {Editor~TypeDescriptor} typeDescriptor The descriptor object describing the set type
     * @param {Array} data The set itself that the control should edit
     * @param {type} [parentPopup] If this array property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} [changeHandler]
     * @returns {Element}
     */
    function _createSetControl(topName, typeDescriptor, data, parentPopup, changeHandler) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                values = new descriptors.Type(typeDescriptor).getValues(true) || [],
                table, i,
                typeName = new descriptors.Type(typeDescriptor).getDisplayName(),
                updateButtonText = function () {
                    button.innerHTML = typeName + " (" + data.length + "/" + values.length + ")";
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                },
                elementChangeHandler = function (index, value) {
                    var elementIndex = data.indexOf(values[index]);
                    if (value) {
                        if (elementIndex === -1) {
                            data.push(values[index]);
                        }
                    } else {
                        if (elementIndex >= 0) {
                            data.splice(elementIndex, 1);
                        }
                    }
                    _updateData(topName);
                    updateButtonText();
                    if (changeHandler) {
                        changeHandler();
                    }
                };
        table = document.createElement("table");
        for (i = 0; i < values.length; i++) {
            _addRow(table, [
                common.createLabel(values[i].toString()),
                common.createBooleanInput(data.indexOf(values[i]) >= 0, elementChangeHandler.bind(this, i))
            ]);
        }
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        _setPopupTogglerButton(button, "", popup);
        updateButtonText();
        button.popup = popup; // custom property referencing the popup
        return button;
    }
    /**
     * Adds a new row at the bottom of the passed table element containing the passed two element in separate cells,
     * with a third cell in between them displaying a colon.
     * @param {Element} table
     * @param {Element} firstElement
     * @param {Element} secondElement
     * @param {Element} [removeButton] The button to put next to the pair that should remove this pair from an array of pairs
     */
    function _addPairRow(table, firstElement, secondElement, removeButton) {
        _addRow(table, [
            firstElement,
            common.createLabel(":"),
            secondElement,
            removeButton
        ]);
    }
    /**
     * Creates and returns a control that can be used to array of pairs type properties. (by opening a popup to edit the pairs in the
     * array)
     * @param {String} topName Name of the top property being edited (under which this array resides)
     * @param {Editor~TypeDescriptor} typeDescriptor The descriptor object describing the pair array type
     * @param {Array} data The array itself that the control should edit
     * @param {Object} topParent The top level object we are editing
     * @param {type} [parentPopup] If this array property editor is displayed within a popup, give a reference to that popup here
     * @returns {Element}
     */
    function _createPairsControl(topName, typeDescriptor, data, topParent, parentPopup) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                label, table, i, addPairButton,
                refreshTable,
                updateLabel = function () {
                    label.textContent = (data.length > 0) ? "list of pairs" : EMPTY_LIST_TEXT;
                },
                updateButtonText = function () {
                    button.innerHTML = new descriptors.Type(typeDescriptor).getDisplayName() + " (" + data.length + ")";
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                },
                addPairEditor = function (index) {
                    _addPairRow(table,
                            _createControl({name: 0, type: typeDescriptor.first.type}, data[index][0], topName, data[index], null, null, topParent, parentPopup),
                            _createControl({name: 1, type: typeDescriptor.second.type}, data[index][1], topName, data[index], null, null, topParent, parentPopup),
                            common.createButton({class: REMOVE_BUTTON_CLASS}, function () {
                                data.splice(index, 1);
                                updateLabel();
                                updateButtonText();
                                refreshTable();
                                popup.alignPosition();
                                _updateData(topName);
                            }));
                };
        refreshTable = function () {
            table.innerHTML = "";
            _addPairRow(table, common.createLabel(typeDescriptor.first.name), common.createLabel(typeDescriptor.second.name));
            for (i = 0; i < data.length; i++) {
                addPairEditor(i);
            }
        };
        addPairButton = common.createButton({class: ADD_BUTTON_CLASS}, function () {
            data.push([
                _getDefaultValue({type: typeDescriptor.first.type}, null, null, null, topParent),
                _getDefaultValue({type: typeDescriptor.second.type}, null, null, null, topParent)]);
            updateLabel();
            updateButtonText();
            addPairEditor(data.length - 1);
            popup.alignPosition();
            _updateData(topName);
        });
        label = common.createLabel();
        updateLabel();
        _addPropertyEditorHeader(popup, [label], [addPairButton]);
        table = document.createElement("table");
        refreshTable();
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        _setPopupTogglerButton(button, "", popup);
        updateButtonText();
        button.popup = popup; // custom property referencing the popup
        return button;
    }
    /**
     * Creates and returns a control that can be used to array of rotations type properties. (by opening a popup to edit the rotations in 
     * the array)
     * @param {String} topName Name of the top property being edited (under which this array resides)
     * @param {Array} data The array itself that the control should edit
     * @param {type} [parentPopup] If this array property editor is displayed within a popup, give a reference to that popup here
     * @returns {Element}
     */
    function _createRotationsControl(topName, data, parentPopup) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                table, i, addRotationButton,
                refreshTable,
                updateButtonText = function () {
                    if (data.length > 1) {
                        button.textContent = data.length + " rotations";
                    } else if (data.length === 1) {
                        button.textContent = data[0].axis + ((data[0].degrees < 0) ? " - " : " + ") + Math.abs(data[0].degrees) + "°";
                    } else {
                        button.textContent = "none";
                    }
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                },
                addRotationEditor = function (index) {
                    _addPairRow(table,
                            _createControl({name: "axis", type: descriptors.AXIS}, data[index].axis, topName, data[index], null, null, null, parentPopup, updateButtonText),
                            _createControl({name: "degrees", type: {baseType: descriptors.BaseType.NUMBER, min: -360, max: 360}}, data[index].degrees, topName, data[index], null, null, null, parentPopup, updateButtonText),
                            common.createButton({class: REMOVE_BUTTON_CLASS}, function () {
                                data.splice(index, 1);
                                updateButtonText();
                                refreshTable();
                                popup.alignPosition();
                                _updateData(topName);
                            }));
                };
        refreshTable = function () {
            table.innerHTML = "";
            _addPairRow(table, common.createLabel("axis"), common.createLabel("degrees"));
            for (i = 0; i < data.length; i++) {
                addRotationEditor(i);
            }
        };
        addRotationButton = common.createButton({class: ADD_BUTTON_CLASS}, function () {
            data.push({
                axis: _getDefaultValue({type: descriptors.AXIS}),
                degrees: _getDefaultValue({type: descriptors.BaseType.NUMBER})
            });
            updateButtonText();
            addRotationEditor(data.length - 1);
            popup.alignPosition();
            _updateData(topName);
        });
        // expand string shorthands to proper objects
        for (i = 0; i < data.length; i++) {
            if (typeof data[i] === "string") {
                data[i] = {
                    axis: data[i][0].toUpperCase(),
                    degrees: parseFloat(data[i].substring(1))
                };
            }
        }
        _addPropertyEditorHeader(popup, [common.createLabel("rotations")], [addRotationButton]);
        table = document.createElement("table");
        refreshTable();
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        _setPopupTogglerButton(button, "", popup);
        updateButtonText();
        button.popup = popup; // custom property referencing the popup
        return button;
    }
    /**
     * Creates and returns a control that can be used to edit confines type properties. (by opening a popup to edit the ranges)
     * @param {String} topName Name of the top property being edited (under which this array resides)
     * @param {Array} data The array itself that the control should edit
     * @param {type} [parentPopup] If this array property editor is displayed within a popup, give a reference to that popup here
     * @returns {Element}
     */
    function _createConfinesControl(topName, data, parentPopup) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                table, i, axis;
        table = document.createElement("table");
        for (i = 0; i < data.length; i++) {
            switch (i) {
                case 0:
                    axis = "X";
                    break;
                case 1:
                    axis = "Y";
                    break;
                case 2:
                    axis = "Z";
                    break;
                default:
                    axis = i.toString();
            }
            _addRow(table, [common.createLabel(axis), _createRangeControl(topName, {elementType: {unit: descriptors.Unit.METERS}}, data[i])]);
        }
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        _setPopupTogglerButton(button, "Confines", popup);
        button.popup = popup; // custom property referencing the popup
        return button;
    }
    /**
     * Creates and returns a control that can be used to edit associative array properties. (by opening a popup to edit the elements of that 
     * array)
     * @param {String} topName Name of the top property being edited (under which this array resides)
     * @param {String[]} [validKeys] If only a set of values are accepted as valid keys in the array, pass them here (if not given, arbitrary string keys can be used)
     * @param {Editor~TypeDescriptor} elementTypeDescriptor The descriptor object describing the type of the elements of the array
     * @param {Object} data The array itself that the control should edit
     * @param {Object} topParent The top level object we are editing
     * @param {type} [parentPopup] If this array property editor is displayed within a popup, give a reference to that popup here
     * @returns {Element}
     */
    function _createAssocArrayControl(topName, validKeys, elementTypeDescriptor, data, topParent, parentPopup) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                table, addEntryButton,
                newEntryKeyEditor, newEntryKeySelector,
                refreshTable,
                /**
                 * Returns the list of valid keys that can still be used (so are not in the array already)
                 * @returns {Array}
                 */
                getValidKeys = function () {
                    var i, result = [];
                    for (i = 0; i < validKeys.length; i++) {
                        if (!data.hasOwnProperty(validKeys[i])) {
                            result.push(validKeys[i]);
                        }
                    }
                    return result;
                },
                updateButtonText = function () {
                    button.innerHTML = new descriptors.Type(elementTypeDescriptor).getDisplayName() + " (" + Object.keys(data).length + ")";
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                },
                /**
                 * Displays the currently available valid keys in the key selector
                 */
                updateEntryKeySelector = function () {
                    var i, option, keys;
                    if (newEntryKeySelector) {
                        while (newEntryKeySelector.options.length > 0) {
                            newEntryKeySelector.remove(0);
                        }
                        keys = getValidKeys();
                        for (i = 0; i < keys.length; i++) {
                            option = document.createElement("option");
                            option.text = keys[i];
                            newEntryKeySelector.add(option);
                        }
                        if (keys.length === 0) {
                            newEntryKeySelector.hidden = true;
                            addEntryButton.disabled = true;
                        } else {
                            newEntryKeySelector.hidden = false;
                            addEntryButton.disabled = false;
                        }
                    }
                },
                addEntryEditor = function (index) {
                    var key = Object.keys(data)[index];
                    _addPairRow(table,
                            common.createLabel(key),
                            _createControl({name: key, type: elementTypeDescriptor}, data[key], topName, data, null, null, topParent, parentPopup),
                            common.createButton({class: REMOVE_BUTTON_CLASS}, function () {
                                delete data[key];
                                updateButtonText();
                                updateEntryKeySelector();
                                refreshTable();
                                popup.alignPosition();
                                _updateData(topName);
                            }));
                },
                getKeyEditor = function () {
                    return validKeys ? newEntryKeySelector : newEntryKeyEditor;
                };
        refreshTable = function () {
            var i, keys = Object.keys(data);
            table.innerHTML = "";
            for (i = 0; i < keys.length; i++) {
                addEntryEditor(i);
            }
        };
        if (!validKeys) {
            newEntryKeyEditor = document.createElement("input");
            newEntryKeyEditor.type = "text";
            newEntryKeyEditor.onchange = function () {
                addEntryButton.disabled = (newEntryKeyEditor.value.length === 0);
            };
        } else {
            newEntryKeySelector = common.createSelector(getValidKeys(), undefined, false, function () {
                addEntryButton.disabled = (newEntryKeySelector.value.length === 0);
            });
        }
        addEntryButton = common.createButton({class: ADD_BUTTON_CLASS}, function () {
            data[getKeyEditor().value] = _getDefaultValue({type: elementTypeDescriptor}, null, null, null, topParent);
            updateButtonText();
            updateEntryKeySelector();
            refreshTable();
            popup.alignPosition();
            _updateData(topName);
        });
        addEntryButton.disabled = (getKeyEditor().value.length === 0);
        _addPropertyEditorHeader(popup, [getKeyEditor()], [addEntryButton]);
        table = document.createElement("table");
        refreshTable();
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        _setPopupTogglerButton(button, "", popup);
        updateButtonText();
        button.popup = popup; // custom property referencing the popup
        return button;
    }
    /**
     * Creates and returns an element that can be used to display the value of properties the type of which is not identified.
     * @param {} data The value of the property to display
     * @returns {Element}
     */
    function _createDefaultControl(data) {
        var result = document.createElement("span");
        result.innerHTML = data.toString();
        result.classList.add(CONTROL_CLASS);
        return result;
    }
    /**
     * Creates and returns a control that can be used to initialize unset properties
     * @param {Editor~PropertyDescriptor} propertyDescriptor
     * @param {String} topName See _changeData
     * @param {Object} parent See _changeData
     * @param {Object} objectParent The parent object of parent
     * @param {Object} topParent The top level object we are editing
     * @param {Popup} [parentPopup] If this property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} [changeHandler] Operations need to be executed in case this property changes
     * @param {Element} [row] The <tr> element within which this control sits
     * @returns {Element}
     */
    function _createUnsetControl(propertyDescriptor, topName, parent, objectParent, topParent, parentPopup, changeHandler, row) {
        var result = document.createElement("div"),
                labelText, defaultValue, label, button, type = new descriptors.Type(propertyDescriptor.type), optional, setProperty, limit = false;
        result.title = "";
        optional = propertyDescriptor.optional || (propertyDescriptor.isRequired && !propertyDescriptor.isRequired(parent, objectParent, _item.name));
        if (((!parent || (parent === _item.data)) && _basedOn) || ((parent !== _item.data) && parent[descriptors.BASED_ON_PROPERTY_NAME])) {
            label = _createDefaultControl(INHERITED_PROPERTY_TEXT);
        } else if ((propertyDescriptor.defaultValue !== undefined) || propertyDescriptor.defaultText || propertyDescriptor.getDerivedDefault) {
            labelText = DEFAULT_PROPERTY_TEXT;
            if (propertyDescriptor.defaultText) {
                labelText = propertyDescriptor.defaultText;
            } else {
                defaultValue = propertyDescriptor.defaultValue;
                if ((defaultValue === undefined) && propertyDescriptor.getDerivedDefault) {
                    defaultValue = propertyDescriptor.getDerivedDefault(parent, objectParent, _item.name);
                }
                if (typeof defaultValue === "number") {
                    labelText = defaultValue.toString();
                    if (type.getUnit()) {
                        labelText += " " + type.getUnit();
                    }
                } else if (typeof defaultValue === "boolean") {
                    labelText = defaultValue ? "yes" : "no";
                } else if (typeof defaultValue === "string") {
                    labelText = defaultValue;
                    limit = true;
                } else if (Array.isArray(defaultValue)) {
                    if (defaultValue.length === 0) {
                        labelText = "empty list";
                    } else {
                        if ((typeof defaultValue[0] === "number") || (typeof defaultValue[0] === "string")) {
                            if (type.getBaseType() === descriptors.BaseType.RANGE) {
                                labelText = defaultValue.map(function (element) {
                                    var elementType = type.getElementType();
                                    return element + ((elementType && elementType.getUnit()) ? " " + elementType.getUnit() : "");
                                }).join(" - ");
                            } else {
                                labelText = defaultValue.join(", ");
                            }
                            if ((propertyDescriptor.type === descriptors.BaseType.COLOR3) || (propertyDescriptor.type === descriptors.BaseType.COLOR4)) {
                                labelText = common.createColorPreview(defaultValue).outerHTML + labelText;
                                limit = false;
                            } else {
                                limit = true;
                            }
                        } else if (typeof defaultValue[0] === "boolean") {
                            labelText = defaultValue.map(function (boolean) {
                                return boolean ? "yes" : "no";
                            }).join(", ");
                            limit = true;
                        }
                    }
                }
            }
            if (limit && (labelText.length > 25)) {
                result.title += labelText + "\n";
                labelText = labelText.substring(0, 22) + "...";
            }
            label = _createDefaultControl(labelText);
        } else if (optional) {
            if (type.getBaseType() === descriptors.BaseType.ROTATIONS) {
                label = _createDefaultControl(NONE_PROPERTY_TEXT);
            } else {
                label = _createDefaultControl(UNSET_PROPERTY_TEXT);
            }
        } else {
            label = _createDefaultControl(UNKNOWN_PROPERTY_TEXT);
        }
        label.classList.add(WITH_SET_PROPERTY_BUTTON_CLASS);
        result.appendChild(label);
        setProperty = function () {
            var value, parentNode = result.parentNode, control;
            if (!parentNode) {
                return;
            }
            value = _getDefaultValue(propertyDescriptor, _basedOn, parent, objectParent, topParent);
            parentNode.removeChild(result);
            if (row) {
                row.classList.remove(UNSET_PROPERTY_ROW_CLASS);
            }
            control = _createControl(propertyDescriptor, value, topName, parent, null, objectParent, topParent, parentPopup, changeHandler, row);
            parentNode.appendChild(control);
            parentNode.control = control;
            _changeData(topName, value, parent, propertyDescriptor.name, changeHandler);
        };
        button = document.createElement("button");
        button.type = "button";
        button.innerHTML = SET_PROPERTY_BUTTON_CAPTION;
        button.className = SET_PROPERTY_BUTTON_CLASS;
        button.onclick = setProperty;
        result.appendChild(button);
        result.title += "Click to set property";
        result.onclick = setProperty;
        if (row) {
            row.classList.add(UNSET_PROPERTY_ROW_CLASS);
        }
        return result;
    }
    /**
     * Start (or stop) editing a property.
     * @param {String} propertyName Name of the property to edit.
     * @param {Number} index Index of the element of the property to edit, if it is an array property.
     * Passing -1 means to stop editing the property.
     */
    function editProperty(propertyName, index) {
        if (_editCallbacks[propertyName]) {
            _editCallbacks[propertyName](index);
        } else {
            application.showError("Cannot edit property '" + propertyName + "': no edit callback found!");
        }
    }
    /**
     * Creates and returns a control that can be used to edit the value of the property described by the passed property description object.
     * Creates the appripriate type of control depending on the type of the property.
     * @param {Editor~PropertyDescriptor} propertyDescriptor Should contain the name and type of the property
     * @param {} data The starting value of the property
     * @param {String} [topName] If the property to edit resides below another property of the main edited item, the name of the property 
     * directly under the main item must be given here (so that the preview can be notified about under which property did the change happen)
     * @param {Object} [parent] If the property to edit resides below another property of the main edited item, the parent object of the
     * edited property must be given here
     * @param {Object} [arrayParent] If the property is the element of an array, the parent parameter will refer to the array, and this one
     * will refer to the parent of the array
     * @param {Object} [objectParent] If the property is the property of an object, this refers to the parent of the object
     * @param {Object} topParent The top level object we are editing
     * @param {Popup} [parentPopup] If this property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} [changeHandler] Operations to be executed in case this property changes
     * @param {Element} [row] The <tr> element within which this control sits
     * @returns {Element}
     */
    _createControl = function (propertyDescriptor, data, topName, parent, arrayParent, objectParent, topParent, parentPopup, changeHandler, row) {
        var
                result, control, button,
                /**
                 * @type Type
                 */
                type = new descriptors.Type(propertyDescriptor.type), elementType, required, optional;
        topName = topName || propertyDescriptor.name;
        required = !!propertyDescriptor.isRequired && propertyDescriptor.isRequired(parent, objectParent, _item.name);
        optional = propertyDescriptor.optional || (propertyDescriptor.isRequired && !propertyDescriptor.isRequired(parent, objectParent, _item.name));
        if (data === undefined) {
            result = _createUnsetControl(propertyDescriptor, topName, parent, objectParent, topParent, parentPopup, changeHandler, row);
        } else {
            switch (type.getBaseType()) {
                case descriptors.BaseType.BOOLEAN:
                    result = _createBooleanControl(topName, data, parent, propertyDescriptor.name, changeHandler);
                    break;
                case descriptors.BaseType.NUMBER:
                    result = _createNumberControl(topName, data, type.isInteger(), changeHandler, parent, propertyDescriptor.name, type.getUnit(), type.getMin(), type.getMax());
                    break;
                case descriptors.BaseType.STRING:
                    if (type.isLong()) {
                        result = _createLongStringControl(topName, data, parent, propertyDescriptor.name, parentPopup, changeHandler);
                    } else {
                        result = _createStringControl(topName, data, parent, propertyDescriptor.name, propertyDescriptor.getSuggestions && propertyDescriptor.getSuggestions(), changeHandler);
                    }
                    break;
                case descriptors.BaseType.ENUM:
                    control = _createEnumControl(topName, descriptors.getPropertyValues(propertyDescriptor, arrayParent || parent, topParent, _item.name), data, parent, propertyDescriptor.name, changeHandler);
                    control.classList.add(CONTROL_CLASS);
                    result = document.createElement("div");
                    result.appendChild(control);
                    if (type.isItemReference()) {
                        control.classList.add(WITH_JUMP_TO_REFERENCE_BUTTON_CLASS);
                        button = common.createButton(JUMP_TO_REFERENCE_BUTTON_CAPTION, function () {
                            _selectItemFunction(type.getReferenceItemType(), control.value, type.getReferenceItemCategory());
                        }, JUMP_TO_REFERENCE_BUTTON_TOOLTIP);
                        button.classList.add(JUMP_TO_REFERENCE_BUTTON_CLASS);
                        result.appendChild(button);
                    }
                    break;
                case descriptors.BaseType.COLOR3:
                case descriptors.BaseType.COLOR4:
                    result = _createColorControl(topName, data);
                    break;
                case descriptors.BaseType.VECTOR3:
                    result = _createVectorControl(topName, data);
                    break;
                case descriptors.BaseType.RANGE:
                    result = _createRangeControl(topName, propertyDescriptor.type, data);
                    break;
                case descriptors.BaseType.PAIRS:
                    result = _createPairsControl(topName, propertyDescriptor.type, data, topParent, parentPopup);
                    break;
                case descriptors.BaseType.ROTATIONS:
                    result = _createRotationsControl(topName, data, parentPopup);
                    break;
                case descriptors.BaseType.SET:
                    result = _createSetControl(topName, propertyDescriptor.type, data, parentPopup, changeHandler);
                    break;
                case descriptors.BaseType.CONFINES:
                    result = _createConfinesControl(topName, data, parentPopup);
                    break;
                case descriptors.BaseType.ARRAY:
                    elementType = type.getElementType();
                    if (elementType.getBaseType() === descriptors.BaseType.OBJECT) {
                        result = _createObjectControl(topName, propertyDescriptor.name, elementType.getDescriptor(), data, parent, topParent, parentPopup, changeHandler, type);
                    } else {
                        result = _createArrayControl(topName, elementType.getDescriptor(), data, parent, topParent, parentPopup, changeHandler, type);
                    }
                    break;
                case descriptors.BaseType.ASSOCIATIVE_ARRAY:
                    result = _createAssocArrayControl(topName, type.getValidKeys(), type.getElementType().getDescriptor(), data, topParent, parentPopup);
                    break;
                case descriptors.BaseType.OBJECT:
                    result = _createObjectControl(topName, propertyDescriptor.name, propertyDescriptor.type, data, parent, topParent, parentPopup, changeHandler);
                    break;
                default:
                    result = _createDefaultControl(data);
            }
            if (row) {
                row.classList.remove(UNSET_PROPERTY_ROW_CLASS);
            }
            // add unset button for optional values
            if (!required && (optional || (propertyDescriptor.defaultValue !== undefined) || propertyDescriptor.getDerivedDefault ||
                    ((!parent || (parent === _item.data)) && _basedOn && (propertyDescriptor.name !== descriptors.NAME_PROPERTY_NAME))) && ((parent !== _item.data) || (propertyDescriptor.name !== descriptors.BASED_ON_PROPERTY_NAME))) {
                if (!control) {
                    control = result;
                    control.classList.add(CONTROL_CLASS);
                    result = document.createElement("div");
                    result.appendChild(control);
                    result.popup = control.popup;
                }
                result.classList.add(WITH_UNSET_PROPERTY_BUTTON_CLASS);
                button = common.createButton(UNSET_PROPERTY_BUTTON_CAPTION, function () {
                    var parentNode = result.parentNode, newControl;
                    if (control.popup) {
                        control.popup.remove();
                    }
                    parentNode.removeChild(result);
                    newControl = _createUnsetControl(propertyDescriptor, topName, parent, objectParent, topParent, parentPopup, changeHandler, row);
                    newControl.classList.add(CONTROL_CLASS);
                    parentNode.appendChild(newControl);
                    parentNode.control = newControl;
                    _changeData(topName, undefined, parent, propertyDescriptor.name, changeHandler);
                }, UNSET_PROPERTY_BUTTON_TOOLTIP);
                button.classList.add(UNSET_PROPERTY_BUTTON_CLASS);
                result.appendChild(button);
            }
        }
        result.classList.add(CONTROL_CLASS);
        return result;
    };
    /**
     * Creates labels and controls to show and edit the properties of an object
     * @param {Element} element The parent HTML element to add the created content to
     * @param {Object} data The object itself that is to be edited
     * @param {Editor~ItemDescriptor} itemDescriptor An object that should contain the property descriptors based on which to create the 
     * controls
     * @param {String} [topName] See _changeData or _createControl
     * @param {Object} parent The parent object of data
     * @param {Object} topParent The top level object we are editing
     * @param {Popup} [parentPopup] If this object property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} changeHandler Operations need to be executed when one of the created controls changes a property 
     * @returns {Element} The element that houses the properties and was added to the parent element
     */
    _createProperties = function (element, data, itemDescriptor, topName, parent, topParent, parentPopup, changeHandler) {
        var
                table, rows, properties, validate, generateRow, generateTable;
        generateRow = function (row, index) {
            var valid, required, nameCell, valueCell, control, propertyDescriptor = itemDescriptor[properties[index]];
            nameCell = document.createElement("td");
            nameCell.classList.add(PROPERTY_CLASS);
            nameCell.innerHTML = propertyDescriptor.name;
            nameCell.title = propertyDescriptor.name + (propertyDescriptor.description ? ": " + propertyDescriptor.description : "");
            row.appendChild(nameCell);
            valueCell = document.createElement("td");
            valid = !propertyDescriptor.isValid || propertyDescriptor.isValid(data, parent, _item.name);
            required = (!!propertyDescriptor.isRequired && propertyDescriptor.isRequired(data, parent, _item.name)) || (!propertyDescriptor.optional && (propertyDescriptor.defaultValue === undefined) && (propertyDescriptor.getDerivedDefault !== undefined));
            if (!valid || (row.required && !required)) {
                delete data[propertyDescriptor.name];
            } else if (required && (data[propertyDescriptor.name] === undefined) && (!_basedOn || (data !== _item.data))) {
                data[propertyDescriptor.name] = _getDefaultValue(propertyDescriptor, null, data, parent, topParent, true, true);
            }
            control = _createControl(propertyDescriptor, data[propertyDescriptor.name], topName, data, null, parent, topParent, parentPopup, validate.bind(this, row, propertyDescriptor.name === descriptors.BASED_ON_PROPERTY_NAME), row);
            valueCell.appendChild(control);
            valueCell.control = control;
            row.appendChild(valueCell);
            row.valueCell = valueCell;
            row.hidden = !valid;
            row.required = required;
            if (!topName) {
                _editCallbacks[propertyDescriptor.name] = function (index) {
                    if (control.edit) {
                        control.edit(index);
                    } else {
                        control.click();
                    }
                };
            }
        };
        generateTable = function () {
            var i, row;
            rows = [];
            for (i = 0; i < properties.length; i++) {
                row = document.createElement("tr");
                row.className = PROPERTY_ROW_CLASS;
                generateRow(row, i);
                table.appendChild(row);
                rows.push(row);
            }
        };
        validate = function (sourceRow, basedOn) {
            var i, valid;
            for (i = 0; i < rows.length; i++) {
                valid = !itemDescriptor[properties[i]].isValid || itemDescriptor[properties[i]].isValid(data, parent, _item.name);
                if ((rows[i].hidden !== !valid) || (valid && (basedOn || (itemDescriptor[properties[i]].updateOnValidate && (sourceRow !== rows[i]))))) {
                    if (rows[i].valueCell.control.popup) {
                        rows[i].valueCell.control.popup.remove();
                    }
                    rows[i].innerHTML = "";
                    generateRow(rows[i], i);
                }
            }
            if (changeHandler) {
                changeHandler();
            }
            if (parentPopup) {
                parentPopup.alignPosition(true);
            }
        };
        table = document.createElement("table");
        table.classList.add(PROPERTIES_CLASS);
        properties = Object.keys(itemDescriptor);
        generateTable();
        element.appendChild(table);
        return table;
    };
    /**
     * Creates the content for the Properties window - the list of available properties and controls to edit their values.
     * @param {Element} element The parent HTML element to add the created content to
     * @param {Editor~Item} item The item for which to display the property values
     * @param {Editor~Preview} preview The module providing the Preview window for the item
     * @param {Function} changeHandler Operations need to be executed one of the created controls changes a property
     * @param {Function} selectItemFunction The function to execute for selecting a new item  in the editor
     */
    createProperties = function (element, item, preview, changeHandler, selectItemFunction) {
        _element = element;
        _item = item;
        _preview = preview;
        if (_preview && _preview.setEditProperty) {
            _preview.setEditProperty(editProperty);
        }
        _nameChangeHandler = changeHandler;
        _selectItemFunction = selectItemFunction;
        _updateBasedOn();
        _editCallbacks = {};
        _createProperties(element, item.data, descriptors.itemDescriptors[item.category], null, null, item.data, null, changeHandler);
    };
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        createProperties: createProperties,
        getDefaultItemData: getDefaultItemData
    };
});