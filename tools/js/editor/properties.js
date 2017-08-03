/**
 * Copyright 2016-2017 Krisztián Nagy
 * @file Provides the content and event handlers for the Properties window of the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, window */
/*jslint white: true, nomen: true, plusplus: true */

/**
 * @param utils Used for enum handling
 * @param resources Used to obtain the list of available resources for resource reference property selectors
 * @param config Used to obtain configuration settings
 * @param classes Used to obtain the list of available classes for class reference property selectors
 * @param descriptors Used to obtain the appropriate properties description object
 * @param common Used to create selectors
 */
define([
    "utils/utils",
    "modules/media-resources",
    "armada/configuration",
    "armada/logic/classes",
    "editor/descriptors",
    "editor/common"
], function (utils, resources, config, classes, descriptors, common) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Constants
            PROPERTIES_CLASS = "propertiesTable",
            PROPERTY_CLASS = "propertyName",
            CONTROL_CLASS = "propertyControl",
            PROPERTY_EDITOR_HEADER_CLASS = "propertyEditorHeader",
            PROPERTY_EDITOR_HEADER_BUTTON_CLASS = "propertyEditorHeaderButton",
            UNSET_PROPERTY_BUTTON_CLASS = "unsetProperty",
            TEXT_AREA_ROWS = 5,
            TEXT_AREA_COLS = 100,
            LONG_TEXT_PREVIEW_LENGTH = 16,
            INHERITED_PROPERTY_TEXT = "inherited",
            DEFAULT_PROPERTY_TEXT = "default",
            DERIVED_PROPERTY_TEXT = "derived",
            UNSET_PROPERTY_TEXT = "unset",
            UNKNOWN_PROPERTY_TEXT = "unknown",
            SET_PROPERTY_BUTTON_CAPTION = "set",
            UNSET_PROPERTY_BUTTON_CAPTION = "x",
            UNSET_PROPERTY_BUTTON_TOOLTIP = "Unset property",
            ADD_BUTTON_CAPTION = "+",
            ADD_BUTTON_TOOLTIP = "Add a new element with default values",
            DUPLICATE_BUTTON_CAPTION = "#",
            DUPLICATE_BUTTON_TOOLTIP = "Duplicate this element",
            REMOVE_BUTTON_CAPTION = "x",
            REMOVE_BUTTON_TOOLTIP = "Remove this element",
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
     * selectedSpacecraftClass.equipmentProfiles[1].weapons[0].class, topName would be "equipmentProfiles" and name would be "class"
     * (and parent should refer to weapons[0]))
     */
    function _changeData(topName, value, parent, name) {
        if (parent) {
            parent[name] = value;
        } else {
            _item.data[topName] = value;
        }
        _updateData(topName);
    }
    /**
     * Creates and returns a control that can be used to edit boolean properties.
     * @param {String} topName Name of the top property being edited
     * @param {Boolean} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @returns {Element}
     */
    function _createBooleanControl(topName, data, parent, name) {
        var result = common.createBooleanInput(data, function (value) {
            _changeData(topName, value, parent, name);
        });
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit string properties.
     * @param {String} topName Name of the top property being edited
     * @param {String} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @param {Function} [onChange] A function to execute every time after the value of the string was changed using this control
     * @returns {Element}
     */
    function _createStringControl(topName, data, parent, name, onChange) {
        var result = document.createElement("input");
        result.type = "text";
        result.value = data;
        result.onchange = function () {
            _changeData(topName, result.value, parent, name);
            if (onChange) {
                onChange(result.value);
            }
        };
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
     * @returns {Element}
     */
    function _createLongStringControl(topName, data, parent, name, parentPopup) {
        var
                textarea = document.createElement("textarea"),
                button, popup;
        button = common.createButton(_getStringPreview(data), function () {
            popup.toggle();
        });
        popup = _createPopup(button, parentPopup, topName, null, function () {
            _changeData(topName, textarea.value, parent, name);
            button.innerHTML = _getStringPreview(textarea.value);
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
     * @param {Boolean} allowFloats If true, float values are allowed (otherwise only integer values)
     * @param {NumberControl~changeHandler} [changeHandler] The function that should be run on the change event of the control, after 
     * checking the value to be a number
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @param {String} [unit] The unit of measurement using which the number is to be interpreted 
     * @returns {Element}
     */
    function _createNumberControl(topName, data, allowFloats, changeHandler, parent, name, unit) {
        var result = document.createElement("div"),
                input = common.createNumericInput(data, allowFloats, function (value) {
                    if (changeHandler) {
                        changeHandler(value);
                    } else {
                        _changeData(topName, value, parent, name);
                    }
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
     * @returns {Element}
     */
    function _createEnumControl(topName, values, data, parent, name) {
        var result = common.createSelector(values, data, false, function () {
            _changeData(topName, result.value, parent, name);
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
     * @param {Number[2]} data The reference to the property to edit
     * @returns {Element}
     */
    function _createRangeControl(name, data) {
        return common.createRangeEditor(data, function () {
            _updateData(name);
        });
    }
    /**
     * Returns the appropriate default value for the property described by the passed descriptor object
     * @param {Editor~PropertyDescriptor} propertyDescriptor
     * @param {GenericResource|GenericClass} basedOn If the resource / class the property of which is considered has a reference to
     * another object as a base (inheriting undefined properties from it), that base resource / class needs to be given here
     * @param {Object} parent The object itself the data of which is considered (see _changeData)
     * @param {Boolean} [undefinedIfOptional=false] If true, the function will return undefined for properties marked as optional and does
     * not have a default value set
     * @param {String} [typeName] The name of the type of the object this property is part of
     * @returns {}
     */
    function _getDefaultValue(propertyDescriptor, basedOn, parent, undefinedIfOptional, typeName) {
        var result, type, propertyDescriptors, propertyDescriptorNames, i;
        type = new descriptors.Type(propertyDescriptor.type);
        // automatic naming - only for string type name properties (can be enum as well)
        if ((propertyDescriptor.name === descriptors.NAME_PROPERTY_NAME) && typeName && (type.getBaseType() === descriptors.BaseType.STRING)) {
            return NEW_OBJECT_NAME_PREFIX + typeName;
        }
        if (undefinedIfOptional && propertyDescriptor.optional && (propertyDescriptor.defaultValue === undefined)) {
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
                        null, undefinedIfOptional);
            }
            return result;
        }
        if (propertyDescriptor.newValue) {
            return utils.deepCopy(propertyDescriptor.newValue);
        }
        if (propertyDescriptor.defaultValue) {
            return utils.deepCopy(propertyDescriptor.defaultValue);
        }
        if (propertyDescriptor.globalDefault && propertyDescriptor.settingName) {
            return utils.deepCopy(config.getSetting(propertyDescriptor.settingName));
        }
        switch (type.getBaseType()) {
            case descriptors.BaseType.BOOLEAN:
                return false;
            case descriptors.BaseType.NUMBER:
                return 0;
            case descriptors.BaseType.STRING:
                return "";
            case descriptors.BaseType.ARRAY:
                result = [];
                if (propertyDescriptor.createDefaultElement) {
                    result.push(_getDefaultValue(
                            {type: propertyDescriptor.type.elementType},
                            null,
                            result,
                            true));
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
                            undefinedIfOptional,
                            type.getName());
                }
                return result;
            case descriptors.BaseType.ENUM:
                return descriptors.getPropertyValues(propertyDescriptor, parent)[0];
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
     * @returns {Object}
     */
    function getDefaultItemData(itemDescriptor, name) {
        var result = {}, i, propertyDescriptor, propertyDescriptorNames = Object.keys(itemDescriptor);
        for (i = 0; i < propertyDescriptorNames.length; i++) {
            propertyDescriptor = itemDescriptor[propertyDescriptorNames[i]];
            if (propertyDescriptor.name === descriptors.NAME_PROPERTY_NAME) {
                result[propertyDescriptor.name] = name;
            } else {
                result[propertyDescriptor.name] = _getDefaultValue(propertyDescriptor, null, null, true);
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
        popup.getElement().appendChild(result);
    }
    /**
     * Creates and returns a control that can be used to edit object properties. (by opening a popup to edit the properties of that object)
     * Can create editors for arrays of objects (of the same type)
     * @param {String} topName Name of the top property being edited (under which this object resides)
     * @param {Editor~TypeDescriptor} typeDescriptor The descriptor object, with BaseType.OBJECT basetype, that describes the properties
     * @param {Object|Array} data The data itself to be modified (an instance of the object the type of which is described, or an array of
     * such objects)
     * @param {Popup} [parentPopup] If this object property editor is displayed within a popup, give a reference to that popup here
     * @param {Boolean} [atLeastOneElementNeeded=false] For object arrays: When true, an empty array is not acceptable, at least one element always has to be set
     * @returns {Element}
     */
    function _createObjectControl(topName, typeDescriptor, data, parentPopup, atLeastOneElementNeeded) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                isArray = (data instanceof Array),
                type = new descriptors.Type(typeDescriptor),
                hasName = type.hasNameProperty(),
                indices, indexLabel, indexSelector,
                addElementButton, removeElementButton, duplicateElementButton,
                propertiesTable,
                nameChangeHandler = function (index, newName) {
                    indexSelector.options[index].text = newName;
                },
                addPropertiesTable = function (index) {
                    propertiesTable = _createProperties(popup.getElement(), (index === undefined) ? data : data[index], typeDescriptor.properties, topName, popup, hasName ? nameChangeHandler.bind(this, index) : null);
                },
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
                        indexLabel.hidden = false;
                        indexSelector.hidden = false;
                        removeElementButton.hidden = !!atLeastOneElementNeeded && (data.length <= 1);
                        duplicateElementButton.hidden = false;
                    } else {
                        indexLabel.hidden = true;
                        indexSelector.hidden = true;
                        removeElementButton.hidden = true;
                        duplicateElementButton.hidden = true;
                    }
                    popup.alignPosition();
                },
                updateButtonText = function () {
                    button.innerHTML = typeDescriptor.name + (isArray ? (" (" + data.length + ")") : "");
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                };
        // for arrays: adding a selector at the top of the popup, using which the instance to modify within the array can be selected
        if (isArray) {
            // if the array elements have a "name" property, use the values of that instead of indices for selection
            indices = [];
            while (indices.length < data.length) {
                indices.push(hasName ? data[indices.length][descriptors.NAME_PROPERTY_NAME] : indices.length.toString());
            }
            indexLabel = common.createLabel(typeDescriptor.name + (hasName ? ":" : " index:"));
            indexSelector = common.createSelector(indices, indices[0], false, indexChangeHandler);
            addElementButton = common.createButton(ADD_BUTTON_CAPTION, function () {
                var newIndex;
                data.push(_getDefaultValue({type: typeDescriptor}, null, null, true));
                updateButtonText();
                newIndex = document.createElement("option");
                newIndex.value = hasName ? data[data.length - 1][descriptors.NAME_PROPERTY_NAME] : (data.length - 1).toString();
                newIndex.text = newIndex.value;
                indexSelector.add(newIndex);
                _updateData(topName);
                indexSelector.selectedIndex = data.length - 1;
                indexChangeHandler();
            }, ADD_BUTTON_TOOLTIP);
            removeElementButton = common.createButton(REMOVE_BUTTON_CAPTION, function () {
                data.splice(indexSelector.selectedIndex, 1);
                updateButtonText();
                _updateData(topName);
                indexSelector.remove(hasName ? indexSelector.selectedIndex : data.length);
                indexChangeHandler();
            }, REMOVE_BUTTON_TOOLTIP);
            duplicateElementButton = common.createButton(DUPLICATE_BUTTON_CAPTION, function () {
                var newIndex;
                data.push(utils.deepCopy(data[indexSelector.selectedIndex]));
                if (hasName) {
                    data[data.length - 1][descriptors.NAME_PROPERTY_NAME] += DUPLICATE_ELEMENT_SUFFIX;
                }
                updateButtonText();
                newIndex = document.createElement("option");
                newIndex.value = hasName ? data[data.length - 1][descriptors.NAME_PROPERTY_NAME] : (data.length - 1).toString();
                newIndex.text = newIndex.value;
                indexSelector.add(newIndex);
                _updateData(topName);
                indexSelector.selectedIndex = data.length - 1;
                indexChangeHandler();
            }, DUPLICATE_BUTTON_TOOLTIP);
            _addPropertyEditorHeader(popup, [indexLabel, indexSelector], [addElementButton, duplicateElementButton, removeElementButton]);
            if (data.length > 0) {
                addPropertiesTable(0);
            } else {
                indexLabel.hidden = true;
                indexSelector.hidden = true;
                removeElementButton.hidden = true;
            }
        } else {
            addPropertiesTable();
        }
        popup.addToPage();
        // create a button using which the popup can be opened
        button.type = "button";
        updateButtonText();
        button.onclick = function () {
            if (isArray) {
                indexSelector.selectedIndex = 0;
                indexChangeHandler();
            }
            popup.toggle();
        };
        button.popup = popup; // custom property referencing the popup
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
     * @param {Array} data The array itself that the control should edit
     * @param {type} [parentPopup] If this array property editor is displayed within a popup, give a reference to that popup here
     * @returns {Element}
     */
    function _createArrayControl(topName, elementTypeDescriptor, data, parentPopup) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                table, addElementButton, i,
                updateButtonText = function () {
                    button.innerHTML = new descriptors.Type(elementTypeDescriptor).getDisplayName() + " (" + data.length + ")";
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                },
                refreshTable,
                addElementEditor = function (index) {
                    _addRow(table, [
                        common.createLabel(index.toString()),
                        _createControl({name: index, type: elementTypeDescriptor}, data[index], topName, data, parentPopup),
                        common.createButton(REMOVE_BUTTON_CAPTION, function () {
                            data.splice(index, 1);
                            updateButtonText();
                            refreshTable();
                            popup.alignPosition();
                            _updateData(topName);
                        })
                    ]);
                };
        refreshTable = function () {
            table.innerHTML = "";
            for (i = 0; i < data.length; i++) {
                addElementEditor(i);
            }
        };
        addElementButton = common.createButton(ADD_BUTTON_CAPTION, function () {
            data.push(_getDefaultValue({type: elementTypeDescriptor}, null, null, true));
            updateButtonText();
            addElementEditor(data.length - 1);
            popup.alignPosition();
            _updateData(topName);
        });
        _addPropertyEditorHeader(popup, [], [addElementButton]);
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
     * @returns {Element}
     */
    function _createSetControl(topName, typeDescriptor, data, parentPopup) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                values = (typeDescriptor.values ?
                        utils.getEnumValues(typeDescriptor.values) :
                        (typeDescriptor.resourceReference ?
                                resources.getResourceNames(typeDescriptor.resourceReference) :
                                (typeDescriptor.classReference ?
                                        classes.getClassNames(typeDescriptor.classReference) :
                                        []))),
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
     * @param {type} [parentPopup] If this array property editor is displayed within a popup, give a reference to that popup here
     * @returns {Element}
     */
    function _createPairsControl(topName, typeDescriptor, data, parentPopup) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                table, i, addPairButton,
                refreshTable,
                updateButtonText = function () {
                    button.innerHTML = new descriptors.Type(typeDescriptor).getDisplayName() + " (" + data.length + ")";
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                },
                addPairEditor = function (index) {
                    _addPairRow(table,
                            _createControl({name: 0, type: typeDescriptor.first.type}, data[index][0], topName, data[index], parentPopup),
                            _createControl({name: 1, type: typeDescriptor.second.type}, data[index][1], topName, data[index], parentPopup),
                            common.createButton(REMOVE_BUTTON_CAPTION, function () {
                                data.splice(index, 1);
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
        addPairButton = common.createButton(ADD_BUTTON_CAPTION, function () {
            data.push([
                _getDefaultValue({type: typeDescriptor.first.type}),
                _getDefaultValue({type: typeDescriptor.second.type})]);
            updateButtonText();
            addPairEditor(data.length - 1);
            popup.alignPosition();
            _updateData(topName);
        });
        _addPropertyEditorHeader(popup, [], [addPairButton]);
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
                    button.innerHTML = "rotations (" + data.length + ")";
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                },
                addRotationEditor = function (index) {
                    _addPairRow(table,
                            _createControl({name: "axis", type: descriptors.AXIS}, data[index].axis, topName, data[index], parentPopup),
                            _createControl({name: "degrees", type: descriptors.BaseType.NUMBER}, data[index].degrees, topName, data[index], parentPopup),
                            common.createButton(REMOVE_BUTTON_CAPTION, function () {
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
        addRotationButton = common.createButton(ADD_BUTTON_CAPTION, function () {
            data.push({
                axis: _getDefaultValue({type: descriptors.AXIS}),
                degrees: _getDefaultValue({type: descriptors.BaseType.NUMBER})
            });
            updateButtonText();
            addRotationEditor(data.length - 1);
            popup.alignPosition();
            _updateData(topName);
        });
        _addPropertyEditorHeader(popup, [], [addRotationButton]);
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
            _addRow(table, [common.createLabel(axis), _createRangeControl(topName, data[i])]);
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
     * @param {type} [parentPopup] If this array property editor is displayed within a popup, give a reference to that popup here
     * @returns {Element}
     */
    function _createAssocArrayControl(topName, validKeys, elementTypeDescriptor, data, parentPopup) {
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
                            _createControl({name: key, type: elementTypeDescriptor}, data[key], topName, data, parentPopup),
                            common.createButton(REMOVE_BUTTON_CAPTION, function () {
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
        addEntryButton = common.createButton(ADD_BUTTON_CAPTION, function () {
            data[getKeyEditor().value] = _getDefaultValue({type: elementTypeDescriptor});
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
     * @param {Popup} [parentPopup] If this property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} [nameChangeHandler] If special operations need to be executed in case this control changes the name property of the 
     * item, the function executing those operations needs to be given here
     * @returns {Element}
     */
    function _createUnsetControl(propertyDescriptor, topName, parent, parentPopup, nameChangeHandler) {
        var result = document.createElement("div"),
                label, button;
        if ((!parent || (parent === _item.data)) && _basedOn) {
            label = _createDefaultControl(INHERITED_PROPERTY_TEXT);
        } else if (!propertyDescriptor.optional && ((propertyDescriptor.defaultValue !== undefined) || propertyDescriptor.globalDefault)) {
            label = _createDefaultControl(DEFAULT_PROPERTY_TEXT + ((typeof propertyDescriptor.defaultValue === "number") ? ": " + propertyDescriptor.defaultValue : ""));
        } else if (propertyDescriptor.defaultDerived) {
            label = _createDefaultControl(DERIVED_PROPERTY_TEXT);
        } else if (propertyDescriptor.optional) {
            label = _createDefaultControl(UNSET_PROPERTY_TEXT);
        } else {
            label = _createDefaultControl(UNKNOWN_PROPERTY_TEXT);
        }
        result.appendChild(label);
        button = document.createElement("button");
        button.type = "button";
        button.innerHTML = SET_PROPERTY_BUTTON_CAPTION;
        button.onclick = function () {
            var value = _getDefaultValue(propertyDescriptor, _basedOn, parent),
                    parentNode = result.parentNode;
            parentNode.removeChild(result);
            parentNode.appendChild(_createControl(propertyDescriptor, value, topName, parent, parentPopup, nameChangeHandler));
            _changeData(topName, value, parent, propertyDescriptor.name);
        };
        result.appendChild(button);
        return result;
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
     * @param {Popup} [parentPopup] If this property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} nameChangeHandler If special operations need to be executed in case this control changes the name property of the 
     * item, the function executing those operations needs to be given here
     * @returns {Element}
     */
    _createControl = function (propertyDescriptor, data, topName, parent, parentPopup, nameChangeHandler) {
        var
                result, control, button,
                /**
                 * @type Type
                 */
                type = new descriptors.Type(propertyDescriptor.type), elementType;
        topName = topName || propertyDescriptor.name;
        if (data === undefined) {
            result = _createUnsetControl(propertyDescriptor, topName, parent, parentPopup, nameChangeHandler);
        } else {
            switch (type.getBaseType()) {
                case descriptors.BaseType.BOOLEAN:
                    result = _createBooleanControl(topName, data, parent, propertyDescriptor.name);
                    break;
                case descriptors.BaseType.NUMBER:
                    result = _createNumberControl(topName, data, true, null, parent, propertyDescriptor.name, type.getUnit());
                    break;
                case descriptors.BaseType.STRING:
                    if (type.isLong()) {
                        result = _createLongStringControl(topName, data, parent, propertyDescriptor.name, parentPopup);
                    } else {
                        result = _createStringControl(topName, data, parent, propertyDescriptor.name, (propertyDescriptor.name === descriptors.NAME_PROPERTY_NAME) ?
                                nameChangeHandler : null);
                    }
                    break;
                case descriptors.BaseType.ENUM:
                    result = _createEnumControl(topName, descriptors.getPropertyValues(propertyDescriptor, parent), data, parent, propertyDescriptor.name);
                    break;
                case descriptors.BaseType.COLOR3:
                case descriptors.BaseType.COLOR4:
                    result = _createColorControl(topName, data);
                    break;
                case descriptors.BaseType.VECTOR3:
                    result = _createVectorControl(topName, data);
                    break;
                case descriptors.BaseType.RANGE:
                    result = _createRangeControl(topName, data);
                    break;
                case descriptors.BaseType.PAIRS:
                    result = _createPairsControl(topName, propertyDescriptor.type, data, parentPopup);
                    break;
                case descriptors.BaseType.ROTATIONS:
                    result = _createRotationsControl(topName, data, parentPopup);
                    break;
                case descriptors.BaseType.SET:
                    result = _createSetControl(topName, propertyDescriptor.type, data, parentPopup);
                    break;
                case descriptors.BaseType.CONFINES:
                    result = _createConfinesControl(topName, data, parentPopup);
                    break;
                case descriptors.BaseType.ARRAY:
                    elementType = type.getElementType();
                    if (elementType.getBaseType() === descriptors.BaseType.OBJECT) {
                        result = _createObjectControl(topName, elementType.getDescriptor(), data, parentPopup, propertyDescriptor.createDefaultElement);
                    } else {
                        result = _createArrayControl(topName, elementType.getDescriptor(), data, parentPopup);
                    }
                    break;
                case descriptors.BaseType.ASSOCIATIVE_ARRAY:
                    result = _createAssocArrayControl(topName, type.getValidKeys(), type.getElementType().getDescriptor(), data, parentPopup);
                    break;
                case descriptors.BaseType.OBJECT:
                    result = _createObjectControl(topName, propertyDescriptor.type, data, parentPopup);
                    break;
                default:
                    result = _createDefaultControl(data);
            }
            // add unset button for optional values
            if ((propertyDescriptor.optional || (propertyDescriptor.defaultValue !== undefined) || propertyDescriptor.globalDefault || propertyDescriptor.defaultDerived ||
                    ((!parent || (parent === _item.data)) && _basedOn && (propertyDescriptor.name !== descriptors.NAME_PROPERTY_NAME))) && (propertyDescriptor.name !== descriptors.BASED_ON_PROPERTY_NAME)) {
                control = result;
                control.classList.add(CONTROL_CLASS);
                button = common.createButton(UNSET_PROPERTY_BUTTON_CAPTION, function () {
                    var parentNode = result.parentNode;
                    if (control.popup) {
                        control.popup.remove();
                    }
                    parentNode.removeChild(result);
                    parentNode.appendChild(_createUnsetControl(propertyDescriptor, topName, parent, parentPopup, nameChangeHandler));
                    _changeData(topName, undefined, parent, propertyDescriptor.name);
                }, UNSET_PROPERTY_BUTTON_TOOLTIP);
                button.classList.add(UNSET_PROPERTY_BUTTON_CLASS);
                result = document.createElement("div");
                result.appendChild(control);
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
     * @param {Popup} [parentPopup] If this object property editor is displayed within a popup, give a reference to that popup here
     * @param {Function} nameChangeHandler If special operations need to be executed one of the created controls changes the name property 
     * of the item, the function executing those operations needs to be given here
     * @returns {Element} The element that houses the properties and was added to the parent element
     */
    _createProperties = function (element, data, itemDescriptor, topName, parentPopup, nameChangeHandler) {
        var
                table, row, nameCell, valueCell, properties, i;
        table = document.createElement("table");
        table.classList.add(PROPERTIES_CLASS);
        properties = Object.keys(itemDescriptor);
        for (i = 0; i < properties.length; i++) {
            row = document.createElement("tr");
            nameCell = document.createElement("td");
            nameCell.classList.add(PROPERTY_CLASS);
            nameCell.innerHTML = itemDescriptor[properties[i]].name;
            nameCell.title = itemDescriptor[properties[i]].name;
            row.appendChild(nameCell);
            valueCell = document.createElement("td");
            valueCell.appendChild(_createControl(itemDescriptor[properties[i]], data[itemDescriptor[properties[i]].name], topName, data, parentPopup, nameChangeHandler));
            row.appendChild(valueCell);
            table.appendChild(row);
        }
        element.appendChild(table);
        return table;
    };
    /**
     * Creates the content for the Properties window - the list of available properties and controls to edit their values.
     * @param {Element} element The parent HTML element to add the created content to
     * @param {Editor~Item} item The item for which to display the property values
     * @param {Editor~Preview} preview The module providing the Preview window for the item
     * @param {Function} nameChangeHandler If special operations need to be executed one of the created controls changes the name property 
     * of the item, the function executing those operations needs to be given here
     */
    createProperties = function (element, item, preview, nameChangeHandler) {
        _element = element;
        _item = item;
        _preview = preview;
        _nameChangeHandler = nameChangeHandler;
        _updateBasedOn();
        _createProperties(element, item.data, descriptors.itemDescriptors[item.category], null, null, nameChangeHandler);
    };
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        createProperties: createProperties,
        getDefaultItemData: getDefaultItemData
    };
});