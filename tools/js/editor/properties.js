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
 * @param utils Used for enum handling
 * @param resources Used to obtain the list of available resources for resource reference property selectors
 * @param classes Used to obtain the list of available classes for class reference property selectors
 * @param descriptors Used to obtain the appropriate properties description object
 * @param common Used to create selectors
 */
define([
    "utils/utils",
    "modules/media-resources",
    "armada/classes",
    "editor/descriptors",
    "editor/common"
], function (utils, resources, classes, descriptors, common) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Constants
            PROPERTIES_CLASS = "propertiesTable",
            PROPERTY_CLASS = "propertyName",
            CONTROL_CLASS = "propertyControl",
            PROPERTY_EDITOR_HEADER_CLASS = "propertyEditorHeader",
            TEXT_AREA_ROWS = 5,
            TEXT_AREA_COLS = 100,
            LONG_TEXT_PREVIEW_LENGTH = 16,
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
            // ------------------------------------------------------------------------------
            // Private functions
            _createControl, _createProperties;
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
        var result = common.createBooleanInput(data, function () {
            _changeData(topName, result.checked, parent, name);
        });
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
                button = document.createElement("button"),
                textarea = document.createElement("textarea"),
                popup = _createPopup(button, parentPopup, topName, null, function () {
                    _changeData(topName, textarea.value, parent, name);
                    button.innerHTML = _getStringPreview(textarea.value);
                });
        button.type = "button";
        button.innerHTML = _getStringPreview(data);
        button.onclick = function () {
            popup.toggle();
        };
        textarea.value = data;
        textarea.cols = TEXT_AREA_COLS;
        textarea.rows = TEXT_AREA_ROWS;
        textarea.spellcheck = false;
        textarea.autocomplete = "off";
        textarea.autocorrect = "off";
        textarea.autocapitalize = "off";
        popup.getElement().appendChild(textarea);
        popup.addToPage();
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
     * Creates and returns a control that can be used to edit enum properties.
     * @param {String} topName Name of the top property being edited
     * @param {Object} values The object defining the enum values
     * @param {String} data The starting value
     * @param {Object} [parent] See _changeData
     * @param {String} [name] See _changeData
     * @returns {Element}
     */
    function _createEnumControl(topName, values, data, parent, name) {
        var result = common.createSelector(utils.getEnumValues(values), data, false, function () {
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
            _changeData(name, data);
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
     * Creates and returns a control that can be used to edit object properties. (by opening a popup to edit the properties of that object)
     * Can create editors for arrays of objects (of the same type)
     * @param {String} topName Name of the top property being edited (under which this object resides)
     * @param {Editor~TypeDescriptor} typeDescriptor The descriptor object, with BaseType.OBJECT basetype, that describes the properties
     * @param {Object|Array} data The data itself to be modified (an instance of the object the type of which is described, or an array of
     * such objects)
     * @param {Popup} [parentPopup] If this object property editor is displayed within a popup, give a reference to that popup here
     * @returns {Element}
     */
    function _createObjectControl(topName, typeDescriptor, data, parentPopup) {
        var
                button = document.createElement("button"),
                popup = _createPopup(button, parentPopup, topName),
                isArray = (data instanceof Array),
                type = new descriptors.Type(typeDescriptor),
                hasName = type.hasNameProperty(),
                header, indices, indexLabel, indexSelector, propertiesTable,
                indexChangeHandler = function () {
                    var index = indexSelector.selectedIndex;
                    if (_preview && !parentPopup) {
                        _preview.handleStartEdit(topName, index);
                    }
                    popup.hideChildren();
                    popup.getElement().removeChild(propertiesTable);
                    propertiesTable = _createProperties(popup.getElement(), data[index], typeDescriptor.properties, topName, popup);
                    popup.alignPosition();
                };
        // for arrays: adding a selector at the top of the popup, using which the instance to modify within the array can be selected
        if (isArray) {
            // if the array elements have a "name" property, use the values of that instead of indices for selection
            indices = [];
            while (indices.length < data.length) {
                indices.push(hasName ? data[indices.length].name : indices.length.toString());
            }
            indexLabel = common.createLabel(typeDescriptor.name + (hasName ? ":" : " index:"));
            indexSelector = common.createSelector(indices, indices[0], false, indexChangeHandler);
            header = document.createElement("div");
            header.classList.add(PROPERTY_EDITOR_HEADER_CLASS);
            header.appendChild(indexLabel);
            header.appendChild(indexSelector);
            popup.getElement().appendChild(header);
        }
        propertiesTable = _createProperties(popup.getElement(), isArray ? (data[0] || {}) : data, typeDescriptor.properties, topName, popup);
        popup.addToPage();
        // create a button using which the popup can be opened
        button.type = "button";
        button.innerHTML = typeDescriptor.name;
        if (isArray) {
            button.innerHTML += " (" + data.length + ")";
        }
        button.onclick = function () {
            if (isArray) {
                indexSelector.selectedIndex = 0;
                indexChangeHandler();
            }
            popup.toggle();
        };
        return button;
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
                elementDescriptor, table, row, cell, indexLabel, propertyEditor, i;
        table = document.createElement("table");
        for (i = 0; i < data.length; i++) {
            indexLabel = common.createLabel(i.toString());
            elementDescriptor = {name: i, type: elementTypeDescriptor};
            propertyEditor = _createControl(elementDescriptor, data[i], topName, data, parentPopup);
            row = document.createElement("tr");
            cell = document.createElement("td");
            cell.appendChild(indexLabel);
            row.appendChild(cell);
            cell = document.createElement("td");
            cell.appendChild(propertyEditor);
            row.appendChild(cell);
            table.appendChild(row);
        }
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        button.type = "button";
        button.innerHTML = new descriptors.Type(elementTypeDescriptor).getDisplayName() + " (" + data.length + ")";
        button.onclick = function () {
            popup.toggle();
        };
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
                values = typeDescriptor.values ?
                utils.getEnumValues(typeDescriptor.values) :
                (typeDescriptor.resourceReference ?
                        resources.getResourceNames(typeDescriptor.resourceReference) :
                        (typeDescriptor.classReference ? classes.getClassNames(typeDescriptor.classReference) : [])),
                table, row, cell, propertyEditor, i,
                typeName = new descriptors.Type(typeDescriptor).getDisplayName(),
                updateButton = function () {
                    button.innerHTML = typeName + " (" + data.length + "/" + values.length + ")";
                    if (parentPopup) {
                        parentPopup.alignPosition();
                    }
                },
                elementChangeHandler = function (index, checkbox) {
                    var elementIndex = data.indexOf(values[index]);
                    if (checkbox.checked) {
                        if (elementIndex === -1) {
                            data.push(values[index]);
                        }
                    } else {
                        if (elementIndex >= 0) {
                            data.splice(elementIndex, 1);
                        }
                    }
                    _updateData(topName);
                    updateButton();
                };
        table = document.createElement("table");
        for (i = 0; i < values.length; i++) {
            propertyEditor = common.createBooleanInput(data.indexOf(values[i]) >= 0, elementChangeHandler.bind(this, i));
            row = document.createElement("tr");
            cell = document.createElement("td");
            cell.appendChild(common.createLabel(values[i].toString()));
            row.appendChild(cell);
            cell = document.createElement("td");
            cell.appendChild(propertyEditor);
            row.appendChild(cell);
            table.appendChild(row);
        }
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        button.type = "button";
        updateButton();
        button.onclick = function () {
            popup.toggle();
        };
        return button;
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
                table, row, cell, propertyEditor, i;
        table = document.createElement("table");
        row = document.createElement("tr");
        cell = document.createElement("td");
        cell.appendChild(common.createLabel(typeDescriptor.first.name));
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.appendChild(common.createLabel(":"));
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.appendChild(common.createLabel(typeDescriptor.second.name));
        row.appendChild(cell);
        table.appendChild(row);
        for (i = 0; i < data.length; i++) {
            row = document.createElement("tr");
            propertyEditor = _createControl({name: 0, type: typeDescriptor.first.type}, data[i][0], topName, data[i], parentPopup);
            cell = document.createElement("td");
            cell.appendChild(propertyEditor);
            row.appendChild(cell);
            cell = document.createElement("td");
            cell.appendChild(common.createLabel(":"));
            row.appendChild(cell);
            cell = document.createElement("td");
            propertyEditor = _createControl({name: 1, type: typeDescriptor.second.type}, data[i][1], topName, data[i], parentPopup);
            cell.appendChild(propertyEditor);
            row.appendChild(cell);
            table.appendChild(row);
        }
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        button.type = "button";
        button.innerHTML = new descriptors.Type(typeDescriptor).getDisplayName() + " (" + data.length + ")";
        button.onclick = function () {
            popup.toggle();
        };
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
                table, row, cell, propertyEditor, i;
        table = document.createElement("table");
        row = document.createElement("tr");
        cell = document.createElement("td");
        cell.appendChild(common.createLabel("axis"));
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.appendChild(common.createLabel(":"));
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.appendChild(common.createLabel("degrees"));
        row.appendChild(cell);
        table.appendChild(row);
        for (i = 0; i < data.length; i++) {
            row = document.createElement("tr");
            propertyEditor = _createControl({name: "axis", type: descriptors.AXIS}, data[i].axis, topName, data[i], parentPopup);
            cell = document.createElement("td");
            cell.appendChild(propertyEditor);
            row.appendChild(cell);
            cell = document.createElement("td");
            cell.appendChild(common.createLabel(":"));
            row.appendChild(cell);
            cell = document.createElement("td");
            propertyEditor = _createControl({name: "degrees", type: descriptors.BaseType.NUMBER}, data[i].degrees, topName, data[i], parentPopup);
            cell.appendChild(propertyEditor);
            row.appendChild(cell);
            table.appendChild(row);
        }
        popup.getElement().appendChild(table);
        popup.addToPage();
        // create a button using which the popup can be opened
        button.type = "button";
        button.innerHTML = "rotations (" + data.length + ")";
        button.onclick = function () {
            popup.toggle();
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
     * @param {Editor~PropertyDescriptor} propertyDescriptor Should contain the name and type of the property
     * @param {} data The starting value of the property
     * @param {String} [topName] If the property to edit resides below another property of the main edited item, the name of the property 
     * directly under the main item must be given here (so that the preview can be notified about under which property did the change happen)
     * @param {Object} [parent] If the property to edit resides below another property of the main edited item, the parent object of the
     * edited property must be given here
     * @param {Popup} [parentPopup] If this property editor is displayed within a popup, give a reference to that popup here
     * @returns {Element}
     */
    _createControl = function (propertyDescriptor, data, topName, parent, parentPopup) {
        var result, type = new descriptors.Type(propertyDescriptor.type), elementType;
        topName = topName || propertyDescriptor.name;
        if (data === undefined) {
            result = _createDefaultControl("inherited");
        } else {
            switch (type.getBaseType()) {
                case descriptors.BaseType.BOOLEAN:
                    result = _createBooleanControl(topName, data, parent, propertyDescriptor.name);
                    break;
                case descriptors.BaseType.NUMBER:
                    result = _createNumberControl(topName, data, true, null, parent, propertyDescriptor.name);
                    break;
                case descriptors.BaseType.STRING:
                    if (type.getResourceReference()) {
                        result = _createResourceReferenceControl(topName, type.getResourceReference(), data, parent, propertyDescriptor.name);
                    } else if (type.getClassReference()) {
                        result = _createClassReferenceControl(topName, type.getClassReference(), data, parent, propertyDescriptor.name);
                    } else if (type.isLong()) {
                        result = _createLongStringControl(topName, data, parent, propertyDescriptor.name, parentPopup);
                    } else {
                        result = _createStringControl(topName, data, parent, propertyDescriptor.name);
                    }
                    break;
                case descriptors.BaseType.ENUM:
                    result = _createEnumControl(topName, propertyDescriptor.type.values, data, parent, propertyDescriptor.name);
                    break;
                case descriptors.BaseType.COLOR:
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
                case descriptors.BaseType.ARRAY:
                    elementType = new descriptors.Type(propertyDescriptor.elementType);
                    if (elementType.getBaseType() === descriptors.BaseType.OBJECT) {
                        result = _createObjectControl(topName, propertyDescriptor.elementType, data, parentPopup);
                    } else {
                        result = _createArrayControl(topName, propertyDescriptor.elementType, data, parentPopup);
                    }
                    break;
                case descriptors.BaseType.OBJECT:
                    result = _createObjectControl(topName, propertyDescriptor.type, data, parentPopup);
                    break;
                default:
                    result = _createDefaultControl(data);
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
     * @returns {Element} The element that houses the properties and was added to the parent element
     */
    _createProperties = function (element, data, itemDescriptor, topName, parentPopup) {
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
            row.appendChild(nameCell);
            valueCell = document.createElement("td");
            valueCell.appendChild(_createControl(itemDescriptor[properties[i]], data[itemDescriptor[properties[i]].name], topName, data, parentPopup));
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
            _item = item;
            _preview = preview;
            _createProperties(element, item.data, descriptors.itemDescriptors[item.category]);
        }
    };
});