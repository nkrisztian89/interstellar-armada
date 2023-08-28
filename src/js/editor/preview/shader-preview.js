/**
 * Copyright 2017, 2020-2021, 2023 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for shader resources within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param resources Used to request the loading of the shader
 * @param graphics Used to process the shader source code according to current graphics settings
 */
define([
    "modules/media-resources",
    "armada/graphics"
], function (resources, graphics) {
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
     * (as HTML table content with the line numbers in one column and the code lines next to it)
     * @param {String} code
     * @returns {String}
     */
    function _processCode(code) {
        var matches;
        code = code.replace(/\/\/(.*?)\n/g, '<span class="glsl-comment">$&</span>');
        code = code.replace(/ {2}/g, "&nbsp;&nbsp;");
        matches = code.match(new RegExp("#define\\s+\\w+\\s+[^\\n]+", "g"));
        code = _markupCode(code, ["#version", "#define", "#elseif", "#ifdef", "#ifndef", "#endif", "#if", "#else"], "glsl-directive");
        if (matches) {
            code = _markupCode(code, matches.map(function (match) {
                return match.split(" ")[1];
            }), "glsl-directive");
        }
        code = _markupCode(code, ["uniform ", "attribute ", "varying ", "const", "precision ", "lowp ", "mediump ", "highp ", "invariant", "struct", "return", "discard", "\\bif\\b", "\\belse\\b", "\\bswitch\\b", "\\bcase\\b", "\\bfor\\b", "\\bdo\\b", "\\bbreak\\b", "\\bcontinue\\b", "true", "false"], "glsl-keyword");
        code = _markupCode(code, ["void", "bool", "\\bint\\b", "float", "\\bvec2", "\\bvec3", "\\bvec4", "\\bmat2", "\\bmat3", "\\bmat4", "\\bivec2", "\\bivec3", "\\bivec4", "\\bbvec2", "\\bbvec3", "\\bbvec4", "sampler2D", "samplerCube"], "glsl-type");
        code = _markupCode(code, ["gl_Position", "gl_FragColor"], "glsl-variable");
        code = _markupCode(code, ["dot\\(", "cross\\(", "length\\(", "normalize\\(", "reflect\\(", "abs\\(", "sign\\(", "fract\\(", "min\\(", "max\\(", "pow\\(", "sin\\(", "cos\\(", "mix\\(", "step\\(", "clamp\\(", "texture2D\\(", "textureCube\\("], "glsl-function");
        code = _markupCode(code, ["\\(", "\\)", "\\[", "\\]"], "glsl-operator");
        return "<tbody>" + code.split("\n").map(function (line, index) {
            return '<tr><td class="shader-line-number">' + index + "</td><td>" + line + "</td></tr>";
        }).join("") + "</tbody>";
    }
    /**
     * Returns additional information to be displayed in the info section of the preview
     * @param {ManagedShader} managedShader
     * @returns {String}
     */
    function _getInfo(managedShader) {
        return "Attribute vectors: " + managedShader.getNumAttributeVectors() + ", vertex uniform vectors: " + managedShader.getNumVertexUniformVectors() + ", " +
                "varying vectors: " + managedShader.getNumVaryingVectors() + ", fragment uniform vectors: " + managedShader.getNumFragmentUniformVectors() + "<br>" +
                "Texture units: " + managedShader.getNumTextureUnits();
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
        var managedShader;
        _shaderResource = shaderResource || _shaderResource;
        _elements = elements || _elements;
        graphics.getShader(_shaderResource.getName());
        resources.executeWhenReady(function () {
            var vertexShaderTitle, vertexShaderCode, code, fragmentShaderTitle, fragmentShaderCode;
            _elements.options.hidden = true;
            _elements.div.hidden = false;
            _elements.canvas.hidden = true;

            managedShader = graphics.getManagedShader(_shaderResource.getName());

            _codeDiv = document.createElement("div");
            _codeDiv.classList.add("previewContent");
            vertexShaderTitle = document.createElement("h1");
            vertexShaderTitle.textContent = "Vertex shader";
            vertexShaderTitle.classList.add("glsl-header");
            _codeDiv.appendChild(vertexShaderTitle);
            vertexShaderCode = document.createElement("table");
            vertexShaderCode.classList.add("glsl-code");
            code = managedShader.getVertexShaderSource();
            vertexShaderCode.innerHTML = _processCode(code);
            _codeDiv.appendChild(vertexShaderCode);
            fragmentShaderTitle = document.createElement("h1");
            fragmentShaderTitle.textContent = "Fragment shader";
            fragmentShaderTitle.classList.add("glsl-header");
            _codeDiv.appendChild(fragmentShaderTitle);
            fragmentShaderCode = document.createElement("table");
            fragmentShaderCode.classList.add("glsl-code");
            code = managedShader.getFragmentShaderSource();
            fragmentShaderCode.innerHTML = _processCode(code);
            _codeDiv.appendChild(fragmentShaderCode);
            _elements.div.appendChild(_codeDiv);

            _elements.info.innerHTML = _getInfo(managedShader);
            _elements.info.hidden = !_elements.info.innerHTML;

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
