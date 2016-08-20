/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides some common functions to be used for the Interstellar Armada editor.
 * Interstellar Armada for the editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, window */
/*jslint plusplus: true, white: true, nomen: true */

/**
 * @param utils Used for converting between float / hex colors
 * @param resources Used for obtaining resource references
 * @param classes Used for obtaining class references
 */
define([
    "utils/utils",
    "modules/media-resources",
    "armada/classes"
], function (utils, resources, classes) {
    "use strict";
    /**
     * @typedef {Object} Editor~Item
     * @property {String} type (enum ItemType)
     * @property {String} name
     * @property {String} category
     * @property {GenericResource|GenericClass} reference
     * @property {Object} data
     */
    /**
     * @typedef {Object} Editor~Preview
     * @property {Function} refresh
     * @property {Function} handleDataChanged
     * @property {Function} handleStartEdit
     * @property {Function} handleStopEdit
     */
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
    LABEL_CLASS = "label",
            NUMERIC_INPUT_CLASS = "numericInput",
            COLOR_COMPONENT_CLASS = "colorComponent",
            COLOR_PICKER_CLASS = "colorPicker",
            COLOR_PREVIEW_CLASS = "colorPreview",
            VECTOR_COMPONENT_CLASS = "vectorComponent",
            RANGE_CHECKBOX_CLASS = "rangeCheckbox",
            RANGE_NUMERIC_INPUT_CLASS = "rangeNumericInput",
            POPUP_CLASS = "popup",
            POPUP_START_Z_INDEX = 1000,
            POPUP_RIGHT_MARGIN = 4,
            POPUP_BOTTOM_MARGIN = 4,
            EVENT_SHOW_NAME = "show",
            EVENT_HIDE_NAME = "hide",
            // ------------------------------------------------------------------------------
            // Private variables
            /**
             * A list of the root level Popups added to document.body
             * @type Popup[]
             */
            _popups = [],
            /**
             * The current highest Z index, assigned to the last popup element
             * @type Number
             */
            _maxZIndex;
    // ------------------------------------------------------------------------------
    // Public functions
    /**
     * Returns the game class (resource / class) the passed item references
     * @param {Editor~Item} item
     * @returns {GenericResource|GenericClass}
     */
    function getItemReference(item) {
        switch (item.type) {
            case ItemType.RESOURCE:
                return resources.getResource(item.category, item.name);
            case ItemType.CLASS:
                return classes.getClass(item.category, item.name);
            default:
                document.crash();
        }
        return null;
    }
    /**
     * Creates and returns a simple label - a span with a style and the given text content
     * @param {String} text
     * @returns {Element}
     */
    function createLabel(text) {
        var result = document.createElement("span");
        result.classList.add(LABEL_CLASS);
        result.innerHTML = text;
        return result;
    }
    /**
     * Creates and returns a button.
     * @param {String} caption The text to show on the button (innerHTML)
     * @param {Function} clickHandler The handler for the click event on the button
     * @returns {Element}
     */
    function createButton(caption, clickHandler) {
        var result = document.createElement("button");
        result.innerHTML = caption;
        result.type = "button";
        result.onclick = clickHandler;
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit boolean values.
     * @param {Boolean} data The starting value
     * @param {Function} [changeHandler] The function that should be run on the change event
     * @returns {Element}
     */
    function createBooleanInput(data, changeHandler) {
        var result = document.createElement("input");
        result.type = "checkbox";
        result.checked = data;
        result.onchange = changeHandler ? function () {
            changeHandler(result.checked);
        } : null;
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit numeric values.
     * @param {Number} data The starting value
     * @param {Boolean} allowFloats If true, float values are allowed (otherwise only integer values)
     * @param {Function} [changeHandler] The function that should be run on the change event, after checking the value to be a number
     * @returns {Element}
     */
    function createNumericInput(data, allowFloats, changeHandler) {
        var result = document.createElement("input");
        result.classList.add(NUMERIC_INPUT_CLASS);
        result.type = "text";
        result.value = data;
        result.onchange = function () {
            var number = allowFloats ? parseFloat(result.value) : parseInt(result.value, 10);
            if (isNaN(number)) {
                number = 0;
            }
            result.value = number.toString();
            if (changeHandler) {
                changeHandler(number);
            }
        };
        return result;
    }
    /**
     * Creates and returns an HTML <select> element storing the given options (with the same value and text)
     * @param {String[]} options The options to include in the element
     * @param {String} selected The initial text of the element (should be one of the options)
     * @param {Boolean} includeNone If true, an additional, "none" option will be included as the first one
     * @param {Function} onchange The function to set as the element's onchange handler.
     * @returns {Element}
     */
    function createSelector(options, selected, includeNone, onchange) {
        var result = document.createElement("select"), s, i;
        s = includeNone ? '<option value="none">none</option>' : '';
        for (i = 0; i < options.length; i++) {
            s += '<option value="' + options[i] + '">' + options[i] + '</option>';
        }
        result.innerHTML = s;
        if (selected) {
            result.value = selected;
        }
        result.onchange = onchange;
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit color properties.
     * @param {Number[4]} data A reference to the color the control should affect
     * @param {Function} [changeHandler] If given, this function will be called every time the color is changed by the picker
     * @returns {Element}
     */
    function createColorPicker(data, changeHandler) {
        var component, i, components, preview,
                result = document.createElement("div"),
                componentChangeHander = function (index, value) {
                    data[index] = value;
                    preview.value = utils.getHexColor(data);
                    if (changeHandler) {
                        changeHandler();
                    }
                };
        result.classList.add(COLOR_PICKER_CLASS);
        preview = document.createElement("input");
        preview.type = "color";
        preview.classList.add(COLOR_PREVIEW_CLASS);
        preview.value = utils.getHexColor(data);
        preview.onchange = function () {
            var j, color = utils.getColor3FromHex(preview.value);
            for (j = 0; j < color.length; j++) {
                data[j] = color[j];
                components[j].value = color[j];
            }
            if (changeHandler) {
                changeHandler();
            }
        };
        result.appendChild(preview);
        components = [];
        for (i = 0; i < data.length; i++) {
            component = createNumericInput(data[i], true, componentChangeHander.bind(this, i));
            component.classList.add(COLOR_COMPONENT_CLASS);
            result.appendChild(component);
            components.push(component);
        }
        return result;
    }
    /**
     * Sets a new color for a color picker created by createColorPicker(). 
     * Does NOT call the changeHandler of the color input.
     * Does NOT change the reference to the managed color, just copies the values of the components of the given color.
     * @param {Element} element The element that was returned as a result of a createColorPicker() call
     * @param {Number[4]} color The new color to be set for the picker
     */
    function setColorForPicker(element, color) {
        var
                i,
                preview = element.querySelector("." + COLOR_PREVIEW_CLASS),
                components = element.querySelectorAll("." + COLOR_COMPONENT_CLASS);
        preview.value = utils.getHexColor(color);
        for (i = 0; i < components.length; i++) {
            components[i].value = color[i];
        }
    }
    /**
     * Creates and returns a control that can be used to edit numeric vectors
     * @param {Number[]} data A reference to the vector the control should affect
     * @param {Function} [changeHandler]
     * @returns {Element}
     */
    function createVectorEditor(data, changeHandler) {
        var component, i, components,
                result = document.createElement("div"),
                componentChangeHander = function (index, value) {
                    data[index] = value;
                    if (changeHandler) {
                        changeHandler();
                    }
                };
        components = [];
        for (i = 0; i < data.length; i++) {
            component = createNumericInput(data[i], true, componentChangeHander.bind(this, i));
            component.classList.add(VECTOR_COMPONENT_CLASS);
            result.appendChild(component);
            components.push(component);
        }
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit numeric ranges.
     * @param {Number[2]} data A reference to the range that can be edited.
     * @param {Function} [changeHandler] If given, this function will be called every time the range is changed by the control
     * @returns {Element}
     */
    function createRangeEditor(data, changeHandler) {
        var result = document.createElement("div"), minCheckbox, maxCheckbox, minEditor, maxEditor, dash;
        minCheckbox = createBooleanInput(data[0] !== undefined, function () {
            data[0] = minCheckbox.checked ? minEditor.value : undefined;
            minEditor.disabled = !minCheckbox.checked;
            if (changeHandler) {
                changeHandler();
            }
        });
        minCheckbox.classList.add(RANGE_CHECKBOX_CLASS);
        minEditor = createNumericInput(data[0] || 0, function (value) {
            data[0] = minCheckbox.checked ? value : undefined;
            if (changeHandler) {
                changeHandler();
            }
        });
        minEditor.classList.add(RANGE_NUMERIC_INPUT_CLASS);
        if (data[0] === undefined) {
            minEditor.disabled = true;
        }
        maxCheckbox = createBooleanInput(data[1] !== undefined, function () {
            data[1] = maxCheckbox.checked ? maxEditor.value : undefined;
            maxEditor.disabled = !maxCheckbox.checked;
            if (changeHandler) {
                changeHandler();
            }
        });
        maxCheckbox.classList.add(RANGE_CHECKBOX_CLASS);
        maxEditor = createNumericInput(data[1] || 0, function (value) {
            data[1] = maxCheckbox.checked ? value : undefined;
            if (changeHandler) {
                changeHandler();
            }
        });
        maxEditor.classList.add(RANGE_NUMERIC_INPUT_CLASS);
        if (data[1] === undefined) {
            maxEditor.disabled = true;
        }
        dash = createLabel("-");
        result.appendChild(minCheckbox);
        result.appendChild(minEditor);
        result.appendChild(dash);
        result.appendChild(maxCheckbox);
        result.appendChild(maxEditor);
        return result;
    }
    /**
     * @class
     * Represents an (initially hidden) panel that can be shown at a position depending on another element and can have children of the 
     * same type. Showing a popup automatically hides all other popups on the same level.
     * @param {Element} invoker The element under which this popup should show up (at the same left position and directly under it)
     * @param {Popup} [parent] If given, this popup will be added as a child of the given popup
     * @param {Object} [eventHandlers] The fuctions to execute as events happen to the popup, by the names of the events.
     */
    function Popup(invoker, parent, eventHandlers) {
        /**
         * The HTML element that represents this popup.
         * @type Element
         */
        this._element = document.createElement("div");
        this._element.classList.add(POPUP_CLASS);
        this._element.hidden = true;
        /**
         * The children of this popup.
         * @type Popup[]
         */
        this._childPopups = [];
        /**
         * The element under which this popup is displayed.
         * @type Element
         */
        this._invoker = invoker;
        /**
         * The parent of this popup.
         * @type Popup
         */
        this._parent = parent;
        if (this._parent) {
            this._parent._childPopups.push(this);
        }
        /**
         * @type Object
         */
        this._eventHandlers = eventHandlers || {};
    }
    /**
     * Adds the wrapped element to the document body.
     */
    Popup.prototype.addToPage = function () {
        document.body.appendChild(this._element);
        if (!this._parent) {
            _popups.push(this);
        }
    };
    /**
     * Returns the wrapped element.
     * @returns {Element}
     */
    Popup.prototype.getElement = function () {
        return this._element;
    };
    /**
     * Returns whether the popup is currently visible.
     * @returns {Boolean}
     */
    Popup.prototype.isVisible = function () {
        return !this._element.hidden;
    };
    /**
     * If the popup does not fit on the screen, tries to reposition it.
     */
    Popup.prototype.alignPosition = function () {
        var rect, left;
        if (this.isVisible()) {
            rect = this._invoker.getBoundingClientRect();
            this._element.style.left = rect.left + "px";
            this._element.style.top = rect.bottom + "px";
            this._element.style.width = "";
            this._element.style.height = "";
            // first horizontal alignment, as it can change the height by canceling out text wrapping
            rect = this._element.getBoundingClientRect();
            if (rect.right > window.innerWidth - POPUP_RIGHT_MARGIN) {
                this._element.style.left = (window.innerWidth - (rect.right - rect.left) - POPUP_RIGHT_MARGIN) + "px";
                rect = this._element.getBoundingClientRect();
                left = rect.left;
                while ((left > 0) && (rect.right > window.innerWidth - POPUP_RIGHT_MARGIN)) {
                    left -= POPUP_RIGHT_MARGIN;
                    this._element.style.left = left + "px";
                    rect = this._element.getBoundingClientRect();
                }
            }
            if (rect.bottom > window.innerHeight - POPUP_BOTTOM_MARGIN) {
                this._element.style.height = (window.innerHeight - rect.top - 10 - POPUP_BOTTOM_MARGIN) + "px";
                rect = this._element.getBoundingClientRect();
                this._element.style.left = (rect.left - 21) + "px";
                this._element.style.width = ((rect.right - rect.left) + 16) + "px";
            }
            rect = this._element.getBoundingClientRect();
        }
    };
    /**
     * Shows the popup and hides all other popups on the same level. Automatically positions the popup to be under the invoking element and
     * to fit on the screen horizontally (if possible)
     */
    Popup.prototype.show = function () {
        var i;
        if (!this.isVisible()) {
            // hide the other popups open at the same level
            if (!this._parent) {
                for (i = 0; i < _popups.length; i++) {
                    if (_popups[i] !== this) {
                        _popups[i].hide();
                    }
                }
            } else {
                for (i = 0; i < this._parent._childPopups.length; i++) {
                    if (this._parent._childPopups[i] !== this) {
                        this._parent._childPopups[i].hide();
                    }
                }
            }
            // show this popup at the right position
            this._element.hidden = false;
            this.alignPosition();
            this._element.style.zIndex = _maxZIndex;
            _maxZIndex++;
            if (this._eventHandlers[EVENT_SHOW_NAME]) {
                this._eventHandlers[EVENT_SHOW_NAME]();
            }
        }
    };
    /**
     * Hides all of this popup's children.
     */
    Popup.prototype.hideChildren = function () {
        var i;
        for (i = 0; i < this._childPopups.length; i++) {
            this._childPopups[i].hide();
        }
    };
    /**
     * Hides the popup and all its children.
     */
    Popup.prototype.hide = function () {
        if (this.isVisible()) {
            this.hideChildren();
            this._element.hidden = true;
            if (this._eventHandlers[EVENT_HIDE_NAME]) {
                this._eventHandlers[EVENT_HIDE_NAME]();
            }
        }
    };
    /**
     * Toggles the visibility of the popup (shows / hides it depending on the current state)
     */
    Popup.prototype.toggle = function () {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    };
    /**
     * Removes the popup and all its elements from the DOM
     */
    Popup.prototype.remove = function () {
        var i;
        for (i = 0; i < this._childPopups.length; i++) {
            this._childPopups[i].remove();
        }
        document.body.removeChild(this._element);
    };
    /**
     * Removes all popups that were added to document.body
     */
    function removePopups() {
        var i;
        for (i = 0; i < _popups.length; i++) {
            _popups[i].remove();
        }
        _popups = [];
        _maxZIndex = POPUP_START_Z_INDEX;
    }
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        ItemType: ItemType,
        getItemReference: getItemReference,
        createLabel: createLabel,
        createButton: createButton,
        createBooleanInput: createBooleanInput,
        createNumericInput: createNumericInput,
        createSelector: createSelector,
        createColorPicker: createColorPicker,
        setColorForPicker: setColorForPicker,
        createVectorEditor: createVectorEditor,
        createRangeEditor: createRangeEditor,
        Popup: Popup,
        removePopups: removePopups
    };
});