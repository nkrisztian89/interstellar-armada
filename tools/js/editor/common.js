/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides some common functions to be used for the Interstellar Armada editor.
 * Interstellar Armada for the editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document */
/*jslint plusplus: true, white: true */

/**
 * @param utils Used for converting between float / hex colors
 */
define([
    "utils/utils"
], function (utils) {
    "use strict";
    /**
     * @typedef {Object} Editor~Item
     * @property {String} (enum ItemType) type
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
            // Constants
            LABEL_CLASS = "label",
            POPUP_CLASS = "popup",
            NUMERIC_INPUT_CLASS = "numericInput",
            COLOR_COMPONENT_CLASS = "colorComponent",
            COLOR_PREVIEW_CLASS = "colorPreview",
            VECTOR_COMPONENT_CLASS = "vectorComponent";
    // ------------------------------------------------------------------------------
    // Public functions
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
            result.value = allowFloats ? parseFloat(result.value) : parseInt(result.value, 10);
            if (isNaN(result.value)) {
                result.value = 0;
            }
            if (changeHandler) {
                changeHandler(result);
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
                componentChangeHander = function (index, comp) {
                    data[index] = comp.value;
                    preview.value = utils.getHexColor(data);
                    if (changeHandler) {
                        changeHandler();
                    }
                };
        result.style.display = "inline-block";
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
                componentChangeHander = function (index, comp) {
                    data[index] = comp.value;
                    if (changeHandler) {
                        changeHandler();
                    }
                };
        result.style.display = "inline-block";
        components = [];
        for (i = 0; i < data.length; i++) {
            component = createNumericInput(data[i], true, componentChangeHander.bind(this, i));
            component.classList.add(VECTOR_COMPONENT_CLASS);
            result.appendChild(component);
            components.push(component);
        }
        return result;
    }
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        LABEL_CLASS: LABEL_CLASS,
        POPUP_CLASS: POPUP_CLASS,
        createNumericInput: createNumericInput,
        createSelector: createSelector,
        createColorPicker: createColorPicker,
        setColorForPicker: setColorForPicker,
        createVectorEditor: createVectorEditor
    };
});