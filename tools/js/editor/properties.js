/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides the content and event handlers for the Properties window of the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, window */
/*jslint white: true, nomen: true, plusplus: true */

/**
 * @param resources Used to obtain the list of available resources for resource reference property selectors
 * @param classes Used to obtain the list of available classes for class reference property selectors
 * @param descriptors Used to obtain the appropriate properties description object
 * @param common Used to create selectors
 */
define([
    "modules/media-resources",
    "armada/classes",
    "editor/descriptors",
    "editor/common"
], function (resources, classes, descriptors, common) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Constants
            PROPERTIES_CLASS = "propertiesTable",
            PROPERTY_CLASS = "propertyName",
            CONTROL_CLASS = "propertyControl",
            PROPERTY_EDITOR_HEADER_CLASS = "propertyEditorHeader",
            POPUP_START_Z_INDEX = 1000,
            POPUP_PLACEMENT_STEP = 10,
            // ------------------------------------------------------------------------------
            // Private variables
            /**
             * A reference to the selected item the properties of which are displayed
             * @type Editor~Item
             */
            _item,
            /**
             * The module providing the Preview for the item the properties of which are displayed
             * @type Editor~Preview
             */
            _preview,
            /**
             * A list of all the popup elements added straight to document.body
             * @type Element[]
             */
            _popups = [],
            /**
             * The current highest Z index, assigned to the last popup element
             * @type Number
             */
            _maxZIndex,
            // ------------------------------------------------------------------------------
            // Private functions
            _createProperties;
    /**
     * Reinitializes the item the properties of which are edited, and notifies the preview module of the change
     * @param {String} name The name of the property that changed
     */
    function _updateData(name) {
        _item.reference.reloadData();
        if (_preview) {
            _preview.handleDataChanged(name);
        }
    }
    /**
     * Changes the property with the given name (key) in the data object, and notifies the preview module of the change
     * @param {String} topName The name (key) of the property of the edited item which changed / under which the change happened 
     * @param {} value The new value the property is to be changed to
     * @param {Object} [parent] If the changed property belongs to an object below the main item, a reference to that object needs to be 
     * given here
     * @param {String} [name] If the changed property belongs to an object below the main item, the name of the property needs to be given
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
        var result = document.createElement("input");
        result.type = "checkbox";
        result.checked = data;
        result.onchange = function () {
            _changeData(topName, result.checked, parent, name);
        };
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit string properties.
     * @param {String} topName Name of the top property being edited
     * @param {String} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @returns {Element}
     */
    function _createStringControl(topName, data, parent, name) {
        var result = document.createElement("input");
        result.type = "text";
        result.value = data;
        result.onchange = function () {
            _changeData(topName, result.value, parent, name);
        };
        return result;
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
     * @returns {Element}
     */
    function _createNumberControl(topName, data, allowFloats, changeHandler, parent, name) {
        var result = common.createNumericInput(data, allowFloats, function () {
            if (changeHandler) {
                changeHandler(result);
            } else {
                _changeData(topName, result.value, parent, name);
            }
        });
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit resource reference properties.
     * @param {String} topName Name of the top property being edited
     * @param {String} resourceCategory Name of the resource category of the property
     * @param {String} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @returns {Element}
     */
    function _createResourceReferenceControl(topName, resourceCategory, data, parent, name) {
        var result = common.createSelector(resources.getResourceNames(resourceCategory), data, false, function () {
            _changeData(topName, result.value, parent, name);
        });
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit class reference properties.
     * @param {String} topName Name of the top property being edited
     * @param {String} classCategory Name of the class category of the property
     * @param {String} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @returns {Element}
     */
    function _createClassReferenceControl(topName, classCategory, data, parent, name) {
        var result = common.createSelector(classes.getClassNames(classCategory), data, false, function () {
            _changeData(topName, result.value, parent, name);
        });
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit color properties.
     * @param {String} name Name of the property to edit
     * @param {Number[4]} data The starting value
     * @returns {Element}
     */
    function _createColorControl(name, data) {
        return common.createColorPicker(data, function () {
            _changeData(name, data);
        });
    }
    /**
     * Creates and returns a control that can be used to edit numeric vector properties.
     * @param {String} name Name of the property to edit
     * @param {Number[]} data The starting value
     * @returns {Element}
     */
    function _createVectorControl(name, data) {
        return common.createVectorEditor(data, function () {
            _updateData(name);
        });
    }
    /**
     * Returns whether there is a property named "name" among the properties described by the passed descriptor.
     * @param {Object} descriptor An object that should contain property descriptors
     * @returns {Boolean}
     */
    function _hasNameProperty(descriptor) {
        var props = Object.keys(descriptor), i;
        for (i = 0; i < props.length; i++) {
            if (descriptor[props[i]].name === "name") {
                return true;
            }
        }
        return false;
    }
    /**
     * @typedef {Object} ObjectDescriptor
     * @property {String} name
     * @property {Object} properties
     */
    /**
     * Creates and returns a control that can be used to edit object properties. (by opening a popup to edit the properties of that object)
     * Can create editors for arrays of objects (of the same type)
     * @param {String} topName Name of the top property being edited (under which this object resides)
     * @param {ObjectDescriptor} descriptor The descriptor desribing the object's type (structure), including its name and its properties
     * @param {Object|Array} data The data itself to be modified (an instance of the object the type of which is described, or an array of
     * such objects)
     * @returns {Element}
     */
    function _createObjectControl(topName, descriptor, data) {
        var
                button = document.createElement("button"),
                propertyEditor = document.createElement("div"),
                isArray = (data instanceof Array),
                hasName = _hasNameProperty(descriptor.properties),
                header, indices, indexLabel, indexSelector, propertiesTable;
        // creating a popup to edit the object's properties
        propertyEditor.hidden = true;
        propertyEditor.style.position = "absolute";
        propertyEditor.classList.add(common.POPUP_CLASS);
        // for arrays: adding a selector at the top of the popup, using which the instance to modify within the array can be selected
        if (isArray) {
            // if the array elements have a "name" property, use the values of that instead of indices for selection
            indices = [];
            while (indices.length < data.length) {
                indices.push(hasName ? data[indices.length].name : indices.length.toString());
            }
            indexLabel = document.createElement("span");
            indexLabel.classList.add(common.LABEL_CLASS);
            indexLabel.innerHTML = descriptor.name + (hasName ? ":" : " index:");
            indexSelector = common.createSelector(indices, indices[0], false, function () {
                var index = indexSelector.selectedIndex;
                _preview.handleStartEdit(topName, index);
                propertyEditor.removeChild(propertiesTable);
                propertiesTable = _createProperties(propertyEditor, data[index], descriptor.properties, topName);
            });
            header = document.createElement("div");
            header.classList.add(PROPERTY_EDITOR_HEADER_CLASS);
            header.appendChild(indexLabel);
            header.appendChild(indexSelector);
            propertyEditor.appendChild(header);
        }
        propertiesTable = _createProperties(propertyEditor, isArray ? (data[0] || {}) : data, descriptor.properties, topName);
        document.body.appendChild(propertyEditor);
        _popups.push(propertyEditor);
        // create a button using which the popup can be opened
        button.type = "button";
        button.innerHTML = descriptor.name;
        if (isArray) {
            button.innerHTML += " (" + data.length + ")";
        }
        button.onclick = function () {
            var rect = button.getBoundingClientRect(), left = rect.left;
            propertyEditor.style.left = rect.left + "px";
            propertyEditor.style.top = rect.bottom + "px";
            propertyEditor.hidden = !propertyEditor.hidden;
            rect = propertyEditor.getBoundingClientRect();
            while ((left >= POPUP_PLACEMENT_STEP) && (rect.right >= window.innerWidth)) {
                left -= POPUP_PLACEMENT_STEP;
                propertyEditor.style.left = left + "px";
                rect = propertyEditor.getBoundingClientRect();
            }
            if (!propertyEditor.hidden) {
                propertyEditor.style.zIndex = _maxZIndex;
                _maxZIndex++;
                _preview.handleStartEdit(topName, 0);
            } else {
                _preview.handleStopEdit(topName);
            }
        };
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
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit the value of the property described by the passed property description object.
     * Creates the appripriate type of control depending on the type of the property.
     * @param {Object} typeDescriptor Should contain the name and type of the property and possibly additional parameters
     * @param {} data The starting value of the property
     * @param {String} [topName] If the property to edit resides below another property of the main edited item, the name of the property 
     * directly under the main item must be given here (so that the preview can be notified about under which property did the change happen)
     * @param {Object} [parent] If the property to edit resides below another property of the main edited item, the parent object of the
     * edited property must be given here
     * @returns {Element}
     */
    function _createControl(typeDescriptor, data, topName, parent) {
        var result;
        topName = topName || typeDescriptor.name;
        if (data === undefined) {
            result = _createDefaultControl("inherited");
        } else {
            if (typeof typeDescriptor.type === "string") {
                switch (typeDescriptor.type) {
                    case "boolean":
                        result = _createBooleanControl(topName, data, parent, typeDescriptor.name);
                        break;
                    case "number":
                        result = _createNumberControl(topName, data, parent, typeDescriptor.name);
                        break;
                    case "string":
                        if (typeDescriptor.resourceReference) {
                            result = _createResourceReferenceControl(topName, typeDescriptor.resourceReference, data, parent, typeDescriptor.name);
                        } else if (typeDescriptor.classReference) {
                            result = _createClassReferenceControl(topName, typeDescriptor.classReference, data, parent, typeDescriptor.name);
                        } else {
                            result = _createStringControl(topName, data, parent, typeDescriptor.name);
                        }
                        break;
                    case "color":
                        result = _createColorControl(topName, data);
                        break;
                    case "vector3":
                        result = _createVectorControl(topName, data);
                        break;
                    case "array":
                        if (typeof typeDescriptor.elementType === "string") {
                            switch (typeDescriptor.elementType) {
                                case "string":
                                    result = _createDefaultControl(data);
                                    break;
                                default:
                                    result = _createDefaultControl(data);
                            }
                        } else if (typeof typeDescriptor.elementType === "object") {
                            result = _createObjectControl(topName, typeDescriptor.elementType, data);
                        } else {
                            document.crash();
                        }
                        break;
                    default:
                        result = _createDefaultControl(data);
                }
            } else if (typeof typeDescriptor.type === "object") {
                result = _createObjectControl(topName, typeDescriptor.type, data);
            } else {
                document.crash();
            }
        }
        result.classList.add(CONTROL_CLASS);
        return result;
    }
    /**
     * Removes all popups that were added to document.body
     */
    function _removePopups() {
        var i;
        for (i = 0; i < _popups.length; i++) {
            document.body.removeChild(_popups[i]);
        }
        _popups = [];
        _maxZIndex = POPUP_START_Z_INDEX;
    }
    /**
     * Creates labels and controls to show and edit the properties of an object
     * @param {Element} element The parent HTML element to add the created content to
     * @param {Object} data The object itself that is to be edited
     * @param {Object} descriptor An object that should contain the property descriptors based on which to create the controls
     * @param {String} [topName] See _changeData or _createControl
     * @returns {Element} The element that houses the properties and was added to the parent element
     */
    _createProperties = function (element, data, descriptor, topName) {
        var
                table, row, nameCell, valueCell, properties, i;
        table = document.createElement("table");
        table.classList.add(PROPERTIES_CLASS);
        properties = Object.keys(descriptor);
        for (i = 0; i < properties.length; i++) {
            row = document.createElement("tr");
            nameCell = document.createElement("td");
            nameCell.classList.add(PROPERTY_CLASS);
            nameCell.innerHTML = descriptor[properties[i]].name;
            row.appendChild(nameCell);
            valueCell = document.createElement("td");
            valueCell.appendChild(_createControl(descriptor[properties[i]], data[descriptor[properties[i]].name], topName, data));
            row.appendChild(valueCell);
            table.appendChild(row);
        }
        element.appendChild(table);
        return table;
    };
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        /**
         * Creates the content for the Properties window - the list of available properties and controls to edit their values.
         * @param {Element} element The parent HTML element to add the created content to
         * @param {Editor~Item} item The item for which to display the property values
         * @param {Editor~Preview} preview The module providing the Preview window for the item
         */
        createProperties: function (element, item, preview) {
            _removePopups();
            _createProperties(element, item.data, descriptors[item.category]);
            _item = item;
            _preview = preview;
        }
    };
});