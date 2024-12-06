/**
 * Copyright 2016-2017, 2020-2024 Krisztián Nagy
 * @file Provides some common functions to be used for the Interstellar Armada editor.
 * Interstellar Armada for the editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for converting between float / hex colors
 * @param resources Used for obtaining resource references
 * @param classes Used for obtaining class references
 * @param environments Used for obtaining environments
 * @param missions Used for obtaining mission descriptors
 */
define([
    "utils/utils",
    "modules/media-resources",
    "armada/logic/classes",
    "armada/logic/environments",
    "armada/logic/missions"
], function (utils, resources, classes, environments, missions) {
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
                RESOURCE: "resources",
                CLASS: "classes",
                ENVIRONMENT: "environments",
                MISSION: "missions"
            },
            // ------------------------------------------------------------------------------
            // Constants
            LABEL_CLASS = "label",
            STRING_INPUT_CLASS = "stringInput",
            NUMERIC_INPUT_CLASS = "numericInput",
            COLOR_COMPONENT_CLASS = "colorComponent",
            COLOR_PICKER_CLASS = "colorPicker",
            COLOR_INPUT_CLASS = "colorInput",
            COLOR_PREVIEW_CLASS = "colorPreview",
            VECTOR_COMPONENT_CLASS = "vectorComponent",
            RANGE_CHECKBOX_CLASS = "rangeCheckbox",
            RANGE_NUMERIC_INPUT_CLASS = "rangeNumericInput",
            POPUP_CLASS = "popup",
            MOVABLE_CLASS = "movable",
            POPUP_START_Z_INDEX = 1000,
            POPUP_RIGHT_MARGIN = 4,
            POPUP_BOTTOM_MARGIN = 4,
            EVENT_SHOW_NAME = "show",
            EVENT_HIDE_NAME = "hide",
            EVENT_REMOVE_HIDE_NAME = "removeHide",
            SETTING_CLASS = "setting",
            SETTING_LABEL_CLASS = "settingLabel",
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
     * @param {Boolean} [allowNullResult=false]
     * @returns {GenericResource|GenericClass}
     */
    function getItemReference(item, allowNullResult) {
        var result, params = allowNullResult ? {allowNullResult: true} : null;
        switch (item.type) {
            case ItemType.RESOURCE:
                return resources.getResource(item.category, item.name, params);
            case ItemType.CLASS:
                return classes.getClass(item.category, item.name, params);
            case ItemType.ENVIRONMENT:
                return environments.getEnvironment(item.name);
            case ItemType.MISSION:
                missions.requestMissionDescriptor(item.name, function (missionDescriptor) {
                    result = missionDescriptor;
                }, params);
                return result;
            default:
                document.crash();
        }
        return null;
    }
    /**
     * Returns the game items (resources / classes / ...) that are in the same category as the passed item
     * @param {Editor~Item} item
     * @returns {(GenericResource|GenericClass)[]}
     */
    function getItemReferencesOfSameCategory(item) {
        var names, result = [], i;
        switch (item.type) {
            case ItemType.RESOURCE:
                names = resources.getResourceNames(item.category);
                for (i = 0; i < names.length; i++) {
                    result.push(resources.getResource(item.category, names[i]));
                }
                break;
            case ItemType.CLASS:
                names = classes.getClassNames(item.category);
                for (i = 0; i < names.length; i++) {
                    result.push(classes.getClass(item.category, names[i]));
                }
                break;
            case ItemType.ENVIRONMENT:
                names = environments.getEnvironmentNames();
                for (i = 0; i < names.length; i++) {
                    result.push(environments.getEnvironment(names[i]));
                }
                break;
            case ItemType.MISSION:
                break;
            default:
                document.crash();
        }
        return result;
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
     * @param {String|Object} captionOrParams The text to show on the button (textContent),
     * or an object with optional class (CSS class name), title and caption properties
     * @param {Function} clickHandler The handler for the click event on the button
     * @param {String} [tooltip] The tooltip to display when hovering over the button
     * @returns {Element}
     */
    function createButton(captionOrParams, clickHandler, tooltip) {
        var result = document.createElement("button");
        if (typeof captionOrParams === "string") {
            result.textContent = captionOrParams;
        } else {
            if (captionOrParams.class) {
                result.className = captionOrParams.class;
            }
            if (captionOrParams.title) {
                result.title = captionOrParams.title;
            }
            if (captionOrParams.caption) {
                result.textContent = captionOrParams.caption;
            } else {
                result.innerHTML = "&nbsp;";
            }
        }
        result.type = "button";
        result.onclick = clickHandler;
        if (tooltip) {
            result.title = tooltip;
        }
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
     * @typedef {Object} NumericParams
     * @property {Boolean} integer If true, only integer values are allowed (otherwise floats as well)
     * @property {Number} [min] Minimum allowed value
     * @property {Number} [max] Maximum allowed value
     */
    /**
     * Creates and returns a control that can be used to edit numeric values.
     * @param {Number} data The starting value
     * @param {NumericParams} params
     * @param {Function} [changeHandler] The function that should be run on the change event, after checking the value to be a number
     * @returns {Element}
     */
    function createNumericInput(data, params, changeHandler) {
        var result = document.createElement("input");
        result.classList.add(NUMERIC_INPUT_CLASS);
        result.type = params.integer ? "number" : "text";
        if (params.integer) {
            result.min = params.min;
            result.max = params.max;
        }
        result.value = data;
        result.onchange = function () {
            var number = params.integer ? parseInt(result.value, 10) : parseFloat(result.value);
            if (isNaN(number)) {
                number = 0;
            }
            if ((params.min !== undefined) && (number < params.min)) {
                number = params.min;
            }
            if ((params.max !== undefined) && (number > params.max)) {
                number = params.max;
            }
            result.value = number.toString();
            if (changeHandler) {
                changeHandler(number);
            }
        };
        return result;
    }
    /**
     * Sets the appropriate <option> tags for the passed <select> element to correspond to the list of options specified in the passed
     * string list (with text contents and value attributes both being equal to the strings)
     * Alternatively, objects can be in the array with a value (string) property, which will be used for both the value and the text,
     * and a color (string) property, which will be used as the CSS text color for the option.
     * @param {Element} selector
     * @param {String[]|Object[]} options
     */
    function setSelectorOptions(selector, options) {
        var i, s = "";
        for (i = 0; i < options.length; i++) {
            if (typeof options[i] === "string") {
                s += '<option value="' + options[i] + '">' + options[i] + '</option>';
            } else if (typeof options[i] === "object") {
                s += '<option value="' + options[i].value + '" style="color: ' + options[i].color + ';">' + options[i].value + '</option>';
            }
        }
        selector.innerHTML = s;
    }
    /**
     * Returns the list of options available in the passed HTML <select> element as an array of strings
     * @param {Element} selector
     * @returns {String[]} 
     */
    function getSelectorOptions(selector) {
        var i, result = [];
        for (i = 0; i < selector.options.length; i++) {
            result.push(selector.options[i].value);
        }
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
        var result = document.createElement("select");
        if (includeNone) {
            options = ["none"].concat(options);
        }
        setSelectorOptions(result, options);
        if (selected && (options.indexOf(selected) >= 0)) {
            result.value = selected;
        } else {
            result.selectedIndex = 0;
            if (selected && onchange) {
                onchange(result.value);
            }
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
        var component, i, components, input,
                result = document.createElement("div"),
                componentChangeHander = function (index, value) {
                    data[index] = value;
                    input.value = utils.getHexColor(data);
                    if (changeHandler) {
                        changeHandler();
                    }
                };
        result.classList.add(COLOR_PICKER_CLASS);
        input = document.createElement("input");
        input.type = "color";
        input.classList.add(COLOR_INPUT_CLASS);
        input.value = utils.getHexColor(data);
        input.onchange = function () {
            var j, color = utils.getColor3FromHex(input.value);
            for (j = 0; j < color.length; j++) {
                data[j] = color[j];
                components[j].value = color[j];
            }
            if (changeHandler) {
                changeHandler();
            }
        };
        result.appendChild(input);
        components = [];
        for (i = 0; i < data.length; i++) {
            component = createNumericInput(data[i], {min: 0, max: 1}, componentChangeHander.bind(this, i));
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
                input = element.querySelector("." + COLOR_INPUT_CLASS),
                components = element.querySelectorAll("." + COLOR_COMPONENT_CLASS);
        input.value = utils.getHexColor(color);
        for (i = 0; i < components.length; i++) {
            components[i].value = color[i];
        }
    }
    /**
     * 
     * @param {Number[3]} color
     * @returns {Element}
     */
    function createColorPreview(color) {
        var preview = document.createElement("div");
        preview.className = COLOR_PREVIEW_CLASS;
        preview.style.backgroundColor = utils.getHexColor(color);
        return preview;
    }
    /**
     * Creates and returns a control that can be used to edit numeric vectors
     * @param {Number[]} data A reference to the vector the control should affect
     * @param {Function} [changeHandler]
     * @param {Boolean} [isUnitVector=false] Whether or not the edited vector is a unit vector
     * @returns {Element}
     */
    function createVectorEditor(data, changeHandler, isUnitVector) {
        var component, i, components,
                result = document.createElement("div"),
                componentChangeHander = function (index, value) {
                    data[index] = value;
                    if (changeHandler) {
                        changeHandler();
                    }
                },
                blurHandler = isUnitVector ? function (event) {
                    var i, l;
                    // normalize the vector when focus is away from all of the element editors
                    if (components.indexOf(event.relatedTarget) < 0) {
                        l = 0;
                        for (i = 0; i < data.length; i++) {
                            l += data[i] * data[i];
                        }
                        if (l === 0) {
                            l = 1;
                            data[0] = 1;
                        }
                        l = 1 / Math.sqrt(l);
                        for (i = 0; i < data.length; i++) {
                            data[i] = Math.round(data[i] * l * 10e4) * 10e-6;
                            components[i].value = data[i];   
                        }
                        if (changeHandler) {
                            changeHandler();
                        }
                    }
                } : null;
        components = [];
        for (i = 0; i < data.length; i++) {
            component = createNumericInput(data[i], {}, componentChangeHander.bind(this, i));
            component.classList.add(VECTOR_COMPONENT_CLASS);
            component.addEventListener("blur", blurHandler);
            result.appendChild(component);
            components.push(component);
        }
        return result;
    }
    /**
     * Creates and returns a control that can be used to edit numeric ranges.
     * @param {Number[2]} data A reference to the range that can be edited.
     * @param {Object} options
     * @param {Function} [changeHandler] If given, this function will be called every time the range is changed by the control
     * @returns {Element}
     */
    function createRangeEditor(data, options, changeHandler) {
        var result = document.createElement("div"), minCheckbox, maxCheckbox, minEditor, maxEditor, dash,
                minRequired = !!options.minRequired, maxRequired = !!options.maxRequired, elementType = options.elementType || {};
        minCheckbox = createBooleanInput(data[0] !== undefined, function () {
            data[0] = minCheckbox.checked ? minEditor.value : undefined;
            minEditor.disabled = !minCheckbox.checked;
            if (changeHandler) {
                changeHandler();
            }
        });
        minCheckbox.classList.add(RANGE_CHECKBOX_CLASS);
        minEditor = createNumericInput(data[0] || ((elementType.min > 0) ? elementType.min : 0), elementType, function (value) {
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
        maxEditor = createNumericInput(data[1] || ((elementType.min > 0) ? elementType.min : 0), elementType, function (value) {
            data[1] = maxCheckbox.checked ? value : undefined;
            if (changeHandler) {
                changeHandler();
            }
        });
        maxEditor.classList.add(RANGE_NUMERIC_INPUT_CLASS);
        if (data[1] === undefined) {
            maxEditor.disabled = true;
        }
        dash = createLabel((elementType.unit ? elementType.unit + " " : "") + "-");
        if (!minRequired) {
            result.appendChild(minCheckbox);
        }
        result.appendChild(minEditor);
        result.appendChild(dash);
        if (!maxRequired) {
            result.appendChild(maxCheckbox);
        }
        result.appendChild(maxEditor);
        if (elementType.unit) {
            result.appendChild(createLabel(elementType.unit));
        }
        return result;
    }
    /**
     * Creates and returns a <span> HTML element storing the passed text, having the class associated with setting labels.
     * @param {String} text
     * @returns {Element}
     */
    function _createSettingLabel(text) {
        var result = document.createElement("span");
        result.classList.add(SETTING_LABEL_CLASS);
        result.innerHTML = text;
        return result;
    }
    /**
     * Creates a setting element for the preview options panel, with a label and a control
     * @param {Element} control The control to edit the value of the setting
     * @param {String} [labelText] The text that should show on the label (if any)
     * @returns {Element}
     */
    function createSetting(control, labelText) {
        var result = document.createElement("div");
        result.classList.add(SETTING_CLASS);
        if (labelText) {
            result.appendChild(_createSettingLabel(labelText));
        }
        result.appendChild(control);
        return result;
    }
    /**
     * @class
     * Represents an (initially hidden) panel that can be shown at a position depending on another element and can have children of the 
     * same type. Showing a popup automatically hides all other popups on the same level.
     * @param {Element} invoker The element under which this popup should show up (at the same left position and directly under it)
     * @param {Popup} [parent] If given, this popup will be added as a child of the given popup
     * @param {Object} [eventHandlers] The fuctions to execute as events happen to the popup, by the names of the events.
     * @param {Boolean} [movable=true] Whether or not the popup should be able to be dragged with the mouse
     */
    function Popup(invoker, parent, eventHandlers, movable) {
        /**
         * If the user manually positions the popup, this property holds the left coordinate, in pixels.
         * Otherwise set to -1.
         * @type Number
         */
        this._setLeft = -1;
        /**
         * If the user manually positions the popup, this property holds the top coordinate, in pixels.
         * Otherwise set to -1.
         * @type Number
         */
        this._setTop = -1;
        /**
         * The HTML element that represents this popup.
         * @type Element
         */
        this._element = document.createElement("div");
        this._element.classList.add(POPUP_CLASS);
        if (movable !== false) {
            this._element.classList.add(MOVABLE_CLASS);
            this._element.onmousedown = function (event) {
                if (event.target === this._element) {
                    var startX, startY, startLeft, startTop;
                    if (event.which === utils.MouseButton.LEFT) {
                        startX = event.screenX;
                        startY = event.screenY;
                        startLeft = parseFloat(this._element.style.left);
                        startTop = parseFloat(this._element.style.top);
                        document.body.onmousemove = function (moveEvent) {
                            this.alignPosition(true, startLeft + moveEvent.screenX - startX, startTop + moveEvent.screenY - startY);
                            moveEvent.preventDefault();
                        }.bind(this);
                        document.body.onmouseup = function (event) {
                            if (event.which === utils.MouseButton.LEFT) {
                                document.body.onmousemove = null;
                                this._setLeft = parseFloat(this._element.style.left);
                                this._setTop = parseFloat(this._element.style.top);
                            }
                        }.bind(this);
                    }
                }
            }.bind(this);
        }
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
     * @param {Boolean} [recursive=false] If true, all children of the popup are aligned recursively
     * @param {Number} [x] If given, we will align left position to this value
     * @param {Number} [y] If given, we will align top position to this value
     */
    Popup.prototype.alignPosition = function (recursive, x, y) {
        var invokerRect, rect, left, i;
        if (this.isVisible()) {
            invokerRect = this._invoker.getBoundingClientRect();
            this._element.style.left = ((x !== undefined) ? x : (this._setLeft >= 0) ? this._setLeft : invokerRect.left) + "px";
            this._element.style.top = ((y !== undefined) ? y : (this._setTop >= 0) ? this._setTop : invokerRect.bottom) + "px";
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
                if ((x === undefined) && (y === undefined) && (invokerRect.top - rect.height > POPUP_BOTTOM_MARGIN)) {
                    this._element.style.top = (invokerRect.top - rect.height) + "px";
                } else {
                    this._element.style.height = (window.innerHeight - rect.top - 10 - POPUP_BOTTOM_MARGIN) + "px";
                    rect = this._element.getBoundingClientRect();
                    this._element.style.left = (rect.left - 21) + "px";
                    this._element.style.width = ((rect.right - rect.left) + 16) + "px";
                }
            }
            rect = this._element.getBoundingClientRect();
            if (recursive) {
                for (i = 0; i < this._childPopups.length; i++) {
                    this._childPopups[i].alignPosition(true);
                }
            }
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
            this._setLeft = -1;
            this._setTop = -1;
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
     * @param {Boolean} [leaveReference=false] When true, the reference in the module-global popups array is left
     * (used when clearing the whole array, so it is more effective)
     */
    Popup.prototype.remove = function (leaveReference) {
        var i;
        for (i = 0; i < this._childPopups.length; i++) {
            this._childPopups[i].remove();
        }
        if (this.isVisible()) {
            if (this._eventHandlers[EVENT_REMOVE_HIDE_NAME]) {
                this._eventHandlers[EVENT_REMOVE_HIDE_NAME]();
            }
        }
        if (this._element.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }
        if (!leaveReference && !this._parent) {
            _popups.splice(_popups.indexOf(this), 1);
        }
    };
    /**
     * Removes all popups that were added to document.body
     */
    function removePopups() {
        var i;
        for (i = 0; i < _popups.length; i++) {
            _popups[i].remove(true);
        }
        _popups = [];
        _maxZIndex = POPUP_START_Z_INDEX;
    }
    /**
     * Aligns the position of all popups
     */
    function alignPopups() {
        var i;
        for (i = 0; i < _popups.length; i++) {
            _popups[i].alignPosition(true);
        }
    }
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        STRING_INPUT_CLASS: STRING_INPUT_CLASS,
        ItemType: ItemType,
        getItemReference: getItemReference,
        getItemReferencesOfSameCategory: getItemReferencesOfSameCategory,
        createLabel: createLabel,
        createButton: createButton,
        createBooleanInput: createBooleanInput,
        createNumericInput: createNumericInput,
        setSelectorOptions: setSelectorOptions,
        getSelectorOptions: getSelectorOptions,
        createSelector: createSelector,
        createColorPicker: createColorPicker,
        setColorForPicker: setColorForPicker,
        createColorPreview: createColorPreview,
        createVectorEditor: createVectorEditor,
        createRangeEditor: createRangeEditor,
        createSetting: createSetting,
        Popup: Popup,
        removePopups: removePopups,
        alignPopups: alignPopups
    };
});