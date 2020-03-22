/**
 * Copyright 2017, 2020 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for shader resources within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, window */

/**
 * @param resources Used to request the loading of the shader
 */
define([
    "modules/media-resources"
], function (resources) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // Constants
            /**
             * The names of properties the change of which should trigger an update of the preview div
             * @type String[]
             */
            DIV_UPDATE_PROPERTIES = [
                "vertexShaderSource", "fragmentShaderSource"
            ],
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * A reference to the object storing the HTML elements to be used for the preview
             * @type Object
             */
            _elements,
            /**
             * 
             * @type Element
             */
            _codeDiv,
            /**
             * A reference to the displayed skybox class
             * @type ShaderResource
             */
            _shaderResource;
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * Put all the occurrences of the past expressions within the passed code inside
     * an HTML <span> tag with the passed class
     * @param {String} code
     * @param {String[]} expressions
     * @param {String} markupClass
     * @returns {String}
     */
    function _markupCode(code, expressions, markupClass) {
        for (var i = 0; i < expressions.length; i++) {
            code = code.replace(new RegExp(expressions[i], "g"), '<span class="' + markupClass + '">$&</span>');
        }
        return code;
    }
    /**
     * Process and return raw GLSL shader source code to be displayed as syntax highlighted HTML text
     * @param {String} code
     * @returns {String}
     */
    function _processCode(code) {
        code = code.replace(/\/\/(.*?)\n/g, '<span class="glsl-comment">$&</span>');
        code = code.replace(/\n/g, "<br/>");
        code = code.replace(/ {2}/g, "&nbsp;&nbsp;");
        code = _markupCode(code, ["#version", "#define", "#elseif", "#ifdef", "#ifndef", "#endif", "#if", "#else"], "glsl-directive");
        code = _markupCode(code, ["uniform ", "attribute ", "varying ", "precision ", "lowp ", "mediump ", "highp ", "struct", "return", "discard", "\\bif\\b", "\\belse\\b", "\\bswitch\\b", "\\bcase\\b", "\\bfor\\b", "\\bbreak\\b", "\\bcontinue\\b"], "glsl-keyword");
        code = _markupCode(code, ["void", "bool", "\\bint\\b", "float", "vec2", "vec3", "vec4", "mat2", "mat3", "mat4", "sampler2D", "samplerCube"], "glsl-type");
        code = _markupCode(code, ["gl_Position", "gl_FragColor"], "glsl-variable");
        code = _markupCode(code, ["dot\\(", "cross\\(", "length\\(", "normalize\\(", "reflect\\(", "abs\\(", "sign\\(", "fract\\(", "min\\(", "max\\(", "pow\\(", "sin\\(", "cos\\(", "mix\\(", "step\\(", "clamp\\(", "texture2D\\(", "textureCube\\("], "glsl-function");
        code = _markupCode(code, ["\\(", "\\)", "\\[", "\\]"], "glsl-operator");
        return code;
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window for the editor to show the selected 
     * shader recource.
     * @param {Editor~RefreshElements} [elements] References to the HTML elements that can be used for the preview.
     * @param {SpacecraftClass} [shaderResource] The shader resource to preview
     */
    function refresh(elements, shaderResource) {
        _shaderResource = shaderResource || _shaderResource;
        _elements = elements || _elements;
        resources.executeWhenReady(function () {
            var vertexShaderTitle, vertexShaderCode, code, fragmentShaderTitle, fragmentShaderCode;
            _elements.options.hidden = true;
            _elements.div.hidden = false;
            _elements.canvas.hidden = true;
            _elements.info.hidden = true;
            
            _codeDiv = document.createElement("div");
            _codeDiv.classList.add("previewContent");
            vertexShaderTitle = document.createElement("h1");
            vertexShaderTitle.textContent = "Vertex shader";
            vertexShaderTitle.classList.add("glsl-header");
            _codeDiv.appendChild(vertexShaderTitle);
            vertexShaderCode = document.createElement("p");
            vertexShaderCode.classList.add("glsl-code");
            code = _shaderResource.getVertexShaderSource();
            vertexShaderCode.innerHTML = _processCode(code);
            _codeDiv.appendChild(vertexShaderCode);
            fragmentShaderTitle = document.createElement("h1");
            fragmentShaderTitle.textContent = "Fragment shader";
            fragmentShaderTitle.classList.add("glsl-header");
            _codeDiv.appendChild(fragmentShaderTitle);
            fragmentShaderCode = document.createElement("p");
            fragmentShaderCode.classList.add("glsl-code");
            code = _shaderResource.getFragmentShaderSource();
            fragmentShaderCode.innerHTML = _processCode(code);
            _codeDiv.appendChild(fragmentShaderCode);
            _elements.div.appendChild(_codeDiv);
            
            _elements.div.style.height = (_elements.div.parentNode.clientHeight - (_elements.options.clientHeight + _elements.info.clientHeight)) + "px";
        });
        resources.requestResourceLoad();
    }
    /**
     * Clears the preview 
     */
    function clear() {
        if (_codeDiv) {
            _codeDiv.parentNode.removeChild(_codeDiv);
            _codeDiv = null;
        }
    }
    /**
     * Updates the preview (refreshes if needed) in case the property with the given name changed
     * @param {String} name
     */
    function handleDataChanged(name) {
        if (DIV_UPDATE_PROPERTIES.indexOf(name) >= 0) {
            clear();
            refresh();
        }
    }
    /**
     * Called from outside
     */
    function handleStartEdit() {
        return true;
    }
    /**
     * Called from outside
     */
    function handleStopEdit() {
        return true;
    }
    // ----------------------------------------------------------------------
    // Initialization
    // ----------------------------------------------------------------------
    // The public interface of the module
    return {
        refresh: refresh,
        clear: clear,
        handleDataChanged: handleDataChanged,
        handleStartEdit: handleStartEdit,
        handleStopEdit: handleStopEdit
    };
});
