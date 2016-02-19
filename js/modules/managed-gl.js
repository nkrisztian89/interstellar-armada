/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides an interface to interact with WebGL in a managed way. Offers
 * rather low level functionality, but using it is still much more transparent 
 * than accessing WebGL directly.
 * Usage:
 * - create a managed context and associate it with an HTML5 canvas element
 * - create the managed resources that you want to use (textures, shaders,
 * models)
 * - set the data for the managed resources using their provided methods
 * - add the resources to the context
 * - initialize the context
 * - set the shader and its uniforms using the managed resources
 * - use the render function of the model to render it to the context
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, Image, Float32Array */

/**
 * @param application This module uses the logging and error displaying functions of the generic application module
 * @param asyncResource This module uses the AsyncResource class for easier handling of managed context resource preparation
 */
define([
    "modules/application",
    "modules/async-resource"
], function (application, asyncResource) {
    "use strict";
    var
            /**
             * @enum {String}
             * An enumeration storing the possible values for texture filtering
             */
            TextureFiltering = {
                BILINEAR: "bilinear",
                TRILINEAR: "trilinear",
                ANISOTROPIC: "anisotropic"
            },
    _constants = {
        UNIFORM_NAME_PREFIX: "u_",
        UNIFORM_NAME_SUFFIX: "",
        TEXTURE_UNIFORM_NAME_PREFIX: "",
        TEXTURE_UNIFORM_NAME_SUFFIX: "Texture",
        CUBEMAP_UNIFORM_NAME_PREFIX: "",
        CUBEMAP_UNIFORM_NAME_SUFFIX: "Cubemap"
    };
    Object.freeze(TextureFiltering);
    Object.freeze(_constants);
    /**
     * Displays information about an error that has occured in relation with WebGL,
     * adding some basic WebGL support info for easier troubleshooting.
     * @param {String} message A brief error message to show.
     * @param {String} [severity] The severity level of the error. Possible
     * values: "critical", "severe", "minor".
     * @param {String} [details] Additional details to show about the error,
     * with possible explanations or tips how to correct this error.
     * @param {WebGLRenderingContext} gl The WebGL context the error happened in
     * relation with.
     */
    application.showGraphicsError = function (message, severity, details, gl) {
        if (!gl) {
            application.showError(message, severity, details + "\n\nThis is a graphics related error. There is " +
                    "no information available about your graphics support.");
        } else {
            application.showError(message, severity, details + "\n\nThis is a graphics related error.\n" +
                    "Information about your graphics support:\n" +
                    "WebGL version: " + gl.getParameter(gl.VERSION) + "\n" +
                    "Shading language version: " + gl.getParameter(gl.SHADING_LANGUAGE_VERSION) + "\n" +
                    "WebGL vendor: " + gl.getParameter(gl.VENDOR) + "\n" +
                    "WebGL renderer: " + gl.getParameter(gl.RENDERER));
        }
    };
    // ############################################################################################
    /**
     * @class Represents a managed WebGL texture.
     * @param {String} name
     * @param {Image} image The Image object that contains the data of the
     * texture and can be passed to WebGL. It has to already contain the data
     * when you add this texture to any context.
     * @param {Boolean} [useMipmap=true] Whether mipmapping should be used with
     * this texture.
     * @returns {ManagedTexture}
     */
    function ManagedTexture(name, image, useMipmap) {
        /**
         * @type String
         */
        this._name = name;
        /**
         * Contains the data to be passed to WebGL.
         * @type Image
         */
        this._image = image;
        /**
         * Whether mipmapping should be used with this texture.
         * @type Boolean
         */
        this._mipmap = (useMipmap !== undefined) ? useMipmap : true;
        /**
         * The associative array of WebGL texture IDs belonging to managed 
         * contexts which this texture has been associated with. The keys are 
         * the names of the managed contexts, and values are the WebGL IDs 
         * (handles)
         * @type Object
         */
        this._ids = {};
        /**
         * The associative array of bound WebGL texture locations (texture unit indices)
         * belonging to managed contexts which this texture has been associated with. 
         * The keys are the names of the managed contexts, and values are the location
         * indices.
         * @type Object
         */
        this._locations = {};
    }
    /**
     * @returns {String}
     */
    ManagedTexture.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the WebGL ID of this texture valid in the supplied managed context.
     * Error checking is not performed - if there is no valid ID for this context,
     * it will return undefined.
     * @param {ManagedGLContext} context
     * @returns {WebGLTexture}
     */
    ManagedTexture.prototype.getIDForContext = function (context) {
        return this._ids[context.getName()];
    };
    /**
     * Returns the texture unit index where this texture has been last bound to
     * within the passed context.
     * @param {ManagedGLContext} context
     * @returns {Number}
     */
    ManagedTexture.prototype.getTextureBindLocation = function (context) {
        return this._locations[context.getName()];
    };
    /**
     * Sets the texture unit index where this texture should be bound to
     * within the passed context.
     * @param {ManagedGLContext} context
     * @param {Number} location
     */
    ManagedTexture.prototype.setTextureBindLocation = function (context, location) {
        this._locations[context.getName()] = location;
    };
    /**
     * Adds the texture resource to be available for the provided managed WebGL
     * context. If it has already been added, does nothing. (as typically this
     * will be called many times, with different {@link RenderableObject}s containing 
     * the texture request it to be added to the context where they are to be
     * drawn)
     * @param {ManagedGLContext} context
     */
    ManagedTexture.prototype.addToContext = function (context) {
        if (this._ids[context.getName()] === undefined) {
            var gl = context.gl;
            this._ids[context.getName()] = gl.createTexture();
            this._locations[context.getName()] = context.bindTexture(this);
            // Upload the image into the texture.
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
            // Set the parameters so we can render any size image.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            if (this._mipmap === false) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            } else {
                if (context.getFiltering() === TextureFiltering.BILINEAR) {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                } else if (context.getFiltering() === TextureFiltering.TRILINEAR) {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                } else if (context.getFiltering() === TextureFiltering.ANISOTROPIC) {
                    gl.texParameterf(gl.TEXTURE_2D, context.getAnisotropicFilter().TEXTURE_MAX_ANISOTROPY_EXT, 4);
                }
                gl.generateMipmap(gl.TEXTURE_2D);
            }
        }
    };
    /**
     * Clears all previous bindings to managed WebGL contexts.
     */
    ManagedTexture.prototype.clearContextBindings = function () {
        this._ids = {};
        this._locations = {};
    };
    // ############################################################################################
    /**
     * Creates a new Cubemap object.
     * @class Represents a cube mapped texture resource.
     * @param {String} name The name of cubemap resource
     * @param {String[6]} images An array containing the URLs of the 6 faces of
     * the cubemapped texture. The order of the pictures has to be X,Y,Z and within
     * that, always positive first.
     */
    function ManagedCubemap(name, images) {
        // properties for file resource management
        /**
         * The name by wich this resource will be referred to. (has to be unique for
         * each instance)
         * @type String
         */
        this._name = name;
        /**
         * 6 Image objects to manage the loading of the 6 textures of the faces from
         * their source files.
         * @type Image[6]
         */
        this._images = images;
        // properties for WebGL resource management
        /**
         * The associative array of WebGL cubemap IDs belonging to managed contexts 
         * which this cubemap has been associated with. The keys are the names of the managed
         * contexts, and values are the WebGL IDs (handles)
         * @type Object
         */
        this._ids = {};
        /**
         * The associative array of bound WebGL texture locations (texture unit indices)
         * belonging to managed contexts which this cubemap has been associated with. 
         * The keys are the names of the managed contexts, and values are the location
         * indices.
         * @type Object
         */
        this._locations = {};
    }
    /**
     * Getter for the property _name.
     * @returns {String}
     */
    ManagedCubemap.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the WebGL ID of this cubemap valid in the supplied managed context.
     * Error checking is not performed - if there is no valid ID for this context,
     * it will return undefined.
     * @param {ManagedGLContext} context
     * @returns {WebGLTexture}
     */
    ManagedCubemap.prototype.getIDForContext = function (context) {
        return this._ids[context.getName()];
    };
    /**
     * Returns the texture unit index where this cubemap has been last bound to
     * within the passed context.
     * @param {ManagedGLContext} context
     * @returns {Number}
     */
    ManagedCubemap.prototype.getTextureBindLocation = function (context) {
        return this._locations[context.getName()];
    };
    /**
     * Sets the texture unit index where this cubemap should be bound to
     * within the passed context.
     * @param {ManagedGLContext} context
     * @param {Number} location
     */
    ManagedCubemap.prototype.setTextureBindLocation = function (context, location) {
        this._locations[context.getName()] = location;
    };
    /**
     * Adds the cubemap resource to be available for the provided managed WebGL
     * context. If it has already been added, does nothing. (as this might be called 
     * multiple times, with different {@link RenderableObject}s containing 
     * the cubemap request it to be added to the context where they are to be
     * drawn) The action is only executed when the cubemap has been loaded.
     * @param {ManagedGLContext} context
     */
    ManagedCubemap.prototype.addToContext = function (context) {
        var type, i, gl;
        if (this._ids[context.getName()] === undefined) {
            gl = context.gl;
            this._ids[context.getName()] = gl.createTexture();
            this._locations[context.getName()] = context.bindTexture(this);
            // Set the parameters so we can render any size image.
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            type = [
                gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
            ];
            // Upload the images into the texture.
            for (i = 0; i < 6; i++) {
                gl.texImage2D(type[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._images[i]);
            }
        }
    };
    /**
     * Clears all previous bindings to managed WebGL contexts.
     */
    ManagedCubemap.prototype.clearContextBindings = function () {
        this._ids = {};
        this._locations = {};
    };
    // ############################################################################################
    /**
     * Creates a new ShaderAttribute.
     * @class A wrapper class for storing the attributes used in a given shader 
     * program. Used as a simple struct, doesn't have any methods, the only purpose
     * of it is to organize the storage of attribute properties.
     * @param {String} name Name of the shader attribute. (same as defined in the 
     * shader source)
     * @param {Number} size Size of the shader attribute: how many elements does
     * it have (e.g. float -> 1, vec3 -> 3)
     * @param {String} role Role of the shader attribute, based on which the
     * appropriate buffer will be assigned to it to supply the values. Currently
     * supported roles are: position, texCoord, normal, color, luminosity, 
     * shininess, groupIndex.
     */
    function ShaderAttribute(name, size, role) {
        this.name = name;
        this.size = size;
        this.role = role;
    }
    // ############################################################################################
    /**
     * Creates a new ShaderUniform.
     * @class A class representing and wrapping a GLSL uniform variable.
     * @param {String} name The name of the uniform variable. Has to be the same
     * as the name specified in the GLSL source.
     * @param {String} type The type of the uniform variable. Only certain variable
     * types are supported. @see ShaderUniform#VariableTypes
     * @param {Number} arraySize If 0 or undefined, the uniform is not an array. If 
     * one or more, then gives the size of the uniform array.
     */
    function ShaderUniform(name, type, arraySize) {
        // properties for file resource management
        /**
         * The name of the shader uniform, same as how declared in the shader source
         * file(s).
         * @type String
         */
        this._name = name;
        /**
         * The type of variable this uniform is, from an enumeration of supported
         * types. This is used to determine the appropriate assignment function.
         * @see ShaderUniform#VariableTypes
         */
        this._type = this.getVariableTypeFromString(type);
        /**
         * The length of the array in case this uniform is declared as an array in
         * GLSL. Only float and struct arrays are supported so far.
         * @type Number
         */
        this._arraySize = arraySize || 0;
        /**
         * If the uniform is of struct type, other ShaderUniform instances represent
         * its members (and setting it will set the members instead). The members
         * are stored in this array.
         * @type ShaderUniform[]
         */
        this._members = (this._type === this.VariableTypes.struct) ? [] : null;
        // properties for WebGL resource management
        /**
         * The associative array containing the locations of this uniform variable
         * belonging to different managed WebGL contexts. The keys are the names of the managed
         * contexts, and values are the locations.
         * @type Object
         */
        this._locations = {};
    }
    /**
     * @enum Enumeration defining the available (supported) variables types of uniforms.
     * @type Number
     */
    ShaderUniform.prototype.VariableTypes = Object.freeze(
            {
                none: 0,
                float: 1,
                mat4: 2,
                mat3: 3,
                vec3: 4,
                vec4: 5,
                sampler2D: 6,
                samplerCube: 7,
                int: 8,
                bool: 9,
                struct: 10
            });
    /**
     * Determining the enumeration value of a shader variable type from the string
     * containing the name of the variable type so that a faster hash table switch 
     * can be used when selecting the proper assignment function based on the type, 
     * instead of the slower string matching.
     * @param {String} type The name of the variable type 
     */
    ShaderUniform.prototype.getVariableTypeFromString = function (type) {
        switch (type) {
            case "float":
                return this.VariableTypes.float;
            case "mat4":
                return this.VariableTypes.mat4;
            case "mat3":
                return this.VariableTypes.mat3;
            case "vec3":
                return this.VariableTypes.vec3;
            case "vec4":
                return this.VariableTypes.vec4;
            case "sampler2D":
                return this.VariableTypes.sampler2D;
            case"samplerCube":
                return this.VariableTypes.samplerCube;
            case "int":
                return this.VariableTypes.int;
            case "struct":
                return this.VariableTypes.struct;
            case "bool":
                return this.VariableTypes.bool;
            default:
                return this.VariableTypes.none;
        }
    };
    /**
     * Getter for the property _name.
     * @returns {String}
     */
    ShaderUniform.prototype.getName = function () {
        return this._name;
    };
    /**
     * Adds the given shader uniform to the list of members this uniforms has (for
     * struct type uniforms)
     * @param {ShaderUniform} member
     */
    ShaderUniform.prototype.addMember = function (member) {
        if (this._type === this.VariableTypes.struct) {
            this._members.push(member);
        } else {
            application.showError("Attempting to add a member to uniform " + this._name + ", which is not of struct type!");
        }
    };
    /**
     * Gets the location of the uniform in the supplied context and stores it in a
     * member for faster reference with getLocation later.
     * @param {ManagedGLContext} context
     * @param {ManagedShader} shader The shader which this uniform belongs to.
     * @param {String} [locationPrefix] Same as for the setValue() method
     */
    ShaderUniform.prototype.setLocation = function (context, shader, locationPrefix) {
        if (!this._locations[context.getName()]) {
            this._locations[context.getName()] = {};
        }
        this._locations[context.getName()][(locationPrefix || "self")] = context.gl.getUniformLocation(shader.getIDForContext(context), (locationPrefix || "") + this._name);
    };
    /**
     * Gets the location of this uniform valid in the supplied context. For simple uniform types, the location
     * has to be grabbed from the context with a setLocation prior to the usage of this, otherwise it will 
     * return undefined! For complex types (with locationPrefix), the location is grabbed from GL here, if
     * necessary.
     * @param {ManagedGLContext} context
     * @param {ManagedShader} shader The shader which this uniform belongs to.
     * @param {String} [locationPrefix] Same as for the setValue() method
     * @returns {WebGLUniformLocation}
     */
    ShaderUniform.prototype.getLocation = function (context, shader, locationPrefix) {
        if (locationPrefix && (!this._locations[context.getName()] || (this._locations[context.getName()][locationPrefix] === undefined))) {
            this.setLocation(context, shader, locationPrefix);
        }
        return this._locations[context.getName()][(locationPrefix || "self")];
    };
    /**
     * If this uniform is an array, returns the length of the array, otherwise returns 0.
     * @returns {Number}
     */
    ShaderUniform.prototype.getArraySize = function () {
        return this._arraySize;
    };
    /**
     * Returns the name of this uniform with general uniform prefixes and suffixes removed.
     * @returns {String}
     */
    ShaderUniform.prototype.getRawName = function () {
        var result = this._name, parts;
        if (_constants.UNIFORM_NAME_PREFIX.length > 0) {
            parts = result.split(_constants.UNIFORM_NAME_PREFIX);
            result = parts[parts.length - 1];
        }
        if (_constants.UNIFORM_NAME_SUFFIX.length > 0) {
            result = result.split(_constants.UNIFORM_NAME_SUFFIX)[0];
        }
        return result;
    };
    /**
     * If this is a 2D texture sampler, this will return the type of texture it is sampling based on its name (with prefixes and suffixes
     * removed), otherwise will return null. Uniforms without the proper prefixes and suffixes also return null.
     * @returns {String|null}
     */
    ShaderUniform.prototype.getTextureType = function () {
        var result, parts;
        if (this._type !== this.VariableTypes.sampler2D) {
            return null;
        }
        result = this.getRawName();
        if (_constants.TEXTURE_UNIFORM_NAME_PREFIX.length > 0) {
            parts = result.split(_constants.TEXTURE_UNIFORM_NAME_PREFIX);
            if (parts.length < 2) {
                return null;
            }
            result = parts[parts.length - 1];
        }
        if (_constants.TEXTURE_UNIFORM_NAME_SUFFIX.length > 0) {
            parts = result.split(_constants.TEXTURE_UNIFORM_NAME_SUFFIX);
            if (parts.length < 2) {
                return null;
            }
            result = parts[0];
        }
        return result;
    };
    /**
     * @static
     * Returns a name prefixed and suffixed like general uniform variables.
     * @param {String} rawName
     * @returns {String}
     */
    ShaderUniform.prototype.getUniformName = function (rawName) {
        return _constants.UNIFORM_NAME_PREFIX + rawName + _constants.UNIFORM_NAME_SUFFIX;
    };
    /**
     * Sets the value of the shader uniform in the specified GL context to the passed value.
     * @param {ManagedGLContext} context The managed GL context
     * @param {ManagedShader} shader The shader which this uniform belongs to.
     * @param {any} value The new uniform value.
     * The type of this argument should be appropriate to the uniform type.
     * For structs, it needs to be an Object with properties which have names
     * equal to the names of the members of the struct and the values are of 
     * appropriate type for the corresponding member.
     * @param {String} locationPrefix For uniform struct members, this string has to
     * contain the prefix that needs to be appended before their name to get their
     * access string to grab their location from the GL context. E.g. for 
     * "lights[3].color", the name would be "color" and so the prefix should be
     * "lights[3]."
     */
    ShaderUniform.prototype.setConstantValue = function (context, shader, value, locationPrefix) {
        var gl = context.gl, location, i, j, memberName;
        // get the location
        location = this.getLocation(context, shader, locationPrefix);
        // assignment for float and struct arrays
        if (this._arraySize > 0) {
            switch (this._type) {
                case this.VariableTypes.float:
                    gl.uniform1fv(location, value);
                    break;
                case this.VariableTypes.sampler2D:
                    gl.uniform1iv(location, value);
                    break;
                case this.VariableTypes.struct:
                    // for structs, launch recursive assignment of members
                    for (i = 0; i < value.length; i++) {
                        for (j = 0; j < this._members.length; j++) {
                            if (value[i][this._members[j]._name] !== undefined) {
                                memberName = this._members[j]._name;
                                this._members[j].setConstantValue(context, shader, value[i][memberName], this._name + "[" + i + "].");
                            }
                        }
                    }
                    break;
            }
            // assignment of simple types    
        } else {
            switch (this._type) {
                case this.VariableTypes.float:
                    gl.uniform1f(location, value);
                    break;
                case this.VariableTypes.mat4:
                    gl.uniformMatrix4fv(location, false, value);
                    break;
                case this.VariableTypes.mat3:
                    gl.uniformMatrix3fv(location, false, value);
                    break;
                case this.VariableTypes.vec3:
                    gl.uniform3fv(location, value);
                    break;
                case this.VariableTypes.vec4:
                    gl.uniform4fv(location, value);
                    break;
                case this.VariableTypes.sampler2D:
                    gl.uniform1i(location, value);
                    break;
                case this.VariableTypes.samplerCube:
                    gl.uniform1i(location, value);
                    break;
                case this.VariableTypes.int:
                    gl.uniform1i(location, value);
                    break;
                case this.VariableTypes.bool:
                    gl.uniform1i(location, value ? 1 : 0);
                    break;
            }
        }
    };
    /**
     * Sets the value of the shader uniform in the specified GL context to the return value
     * of the passed value function. Passing a function makes sure whatever 
     * calculations need to take place, they are (can be) calculated right before 
     * the uniform assignment if necessary.
     * @param {ManagedGLContext} context The managed GL context
     * @param {ManagedShader} shader The shader which this uniform belongs to.
     * @param {Function} valueFunction The function to calculate the uniform value.
     * The return type of this function should be appropriate to the uniform type.
     * For structs, it needs to return an Object with properties which have names
     * equal to the names of the members of the struct and the values are of 
     * appropriate type for the corresponding member.
     * @param {String} locationPrefix For uniform struct members, this string has to
     * contain the prefix that needs to be appended before their name to get their
     * access string to grab their location from the GL context. E.g. for 
     * "lights[3].color", the name would be "color" and so the prefix should be
     * "lights[3]."
     */
    ShaderUniform.prototype.setValue = function (context, shader, valueFunction, locationPrefix) {
        this.setConstantValue(context, shader, valueFunction(), locationPrefix);
    };
    // ############################################################################################
    /**
     * @class A wrapper class that represents a WebGL vertex buffer object.
     * @param {String} name The name by which this buffer can be referred to.
     * @param {String} role The role of the data in this buffer (e.g. position, 
     * normal, color)
     * @param {Number} vectorSize The number of components in one element of te VBO.
     * @param {Number} numVectors Number of vectors in this buffer.
     */
    function VertexBuffer(name, role, vectorSize, numVectors) {
        /**
         * The name by which this buffer can be referred to. The buffer will be
         * bound to vertex attributes having the same name.
         * @type String
         */
        this._name = name;
        /**
         * The usage role of the data stored in this buffer. This will determine
         * what data this buffer gets filled when grabbing the data from the 3D
         * model resources
         * @type String.
         */
        this._role = role;
        /**
         * The number of (Float32) components in one item of this buffer. E.g. for
         * buffer storing vec2 elements, set to 2.
         * @type Number
         */
        this._vectorSize = vectorSize;
        /**
         * The actual data stored in this buffer.
         * @type Float32Array
         */
        this._data = new Float32Array(numVectors * this._vectorSize);
        /**
         * The WebGL handle for this vertex buffer object.
         * @type WebGLBuffer
         */
        this._id = null;
        /**
         * The associative array of the locations (vertex attribute indices) of 
         * this vertex buffer associated with different shaders. The keys are the
         * names of the shaders, and the values are the indices of the vertex
         * attribute that is associated with the data in this vertex buffer in that
         * shader.
         * @type Object
         */
        this._locations = {};
    }
    /**
     * Returns the name of this vertex buffer.
     * @returns {String}
     */
    VertexBuffer.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the role that the data in this buffer fulfills. (e.g. location
     * or color)
     * @returns {String}
     */
    VertexBuffer.prototype.getRole = function () {
        return this._role;
    };
    /**
     * Sets (overwrites) a part of the data array of this buffer (before sending it 
     * to the GPU memory)
     * @param {Float32Array} data The data to be assigned.
     * @param {Number} start The index of the first vector to be assigned. Starting
     * from this, the data as long as the length of 'data' parameter will be 
     * overwritten.
     */
    VertexBuffer.prototype.setData = function (data, start) {
        this._data.set(data, start * this._vectorSize);
    };
    /**
     * Frees the data stored in the normal RAM (for use after it is already in GPU 
     * memory)
     */
    VertexBuffer.prototype.freeData = function () {
        this._data = null;
    };
    /**
     * Creates the needed VBO in the supplied context and sends over the data (set
     * by setData) using it to the GPU, then erases the original data array.
     * @param {ManagedGLContext} context
     */
    VertexBuffer.prototype.loadToGPUMemory = function (context) {
        this._id = context.gl.createBuffer();
        context.gl.bindBuffer(context.gl.ARRAY_BUFFER, this._id);
        context.gl.bufferData(
                context.gl.ARRAY_BUFFER,
                this._data,
                context.gl.STATIC_DRAW);
        this.freeData();
    };
    /**
     * Binds the vertex buffer to the vertex attribute that has the same name as
     * this buffer (but only if needed because it is bound to a different index at 
     * the moment) within the passed shader and context and also enables the
     * corresponding vertex attribute array.
     * @param {ManagedGLContext} context
     * @param {ManagedShader} shader
     */
    VertexBuffer.prototype.bind = function (context, shader) {
        if (this._locations[shader.getName()] === undefined) {
            this._locations[shader.getName()] = context.gl.getAttribLocation(shader.getIDForContext(context), this._name);
        }
        var location = this._locations[shader.getName()];
        if (context.getBoundVertexBuffer(location) !== this) {
            application.log("Binding vertex buffer '" + this._name + "' to attribute location " + location + " in shader '" + shader.getName() + "'.", 3);
            context.gl.bindBuffer(context.gl.ARRAY_BUFFER, this._id);
            context.gl.vertexAttribPointer(location, this._vectorSize, context.gl.FLOAT, false, 0, 0);
            context.setBoundVertexBuffer(location, this);
            context.gl.enableVertexAttribArray(location);
        }
    };
    /**
     * Deletes the corresponding WebGL buffer object.
     * @param {ManagedGLContext} context
     */
    VertexBuffer.prototype.delete = function (context) {
        context.gl.deleteBuffer(this._id);
    };
    // ############################################################################################
    /**
     * @class A wrapper class around a WebGL Frame Buffer Object (FBO) for managed
     * functionality.
     * @param {String} name The name of the buffer to be created and later be referred to.
     * @param {Number} width The width of the frame buffer. (pixels/texels)
     * @param {Number} height The height of the frame buffer. (pixels/texels)
     * @returns {FrameBuffer}
     */
    function FrameBuffer(name, width, height) {
        /**
         * The name by which this buffer can be referred to.
         * @type String
         */
        this._name = name;
        /**
         * The WebGL handle for this frame buffer object.
         * @type WebGLBuffer
         */
        this._id = null;
        /**
         * The width in pixels/texels.
         * @type Number
         */
        this._width = width;
        /**
         * The height in pixels/texels.
         * @type Number
         */
        this._height = height;
        /**
         * The WebGL handle for the texture object created for this buffer's color
         * attachment.
         * @type WebGLTexture
         */
        this._textureID = null;
        /**
         * The index of the texture unit the texture of this buffer's color attachment
         * was / should be bound to.
         * @type Number
         */
        this._textureLocation = this.TEXTURE_LOCATION_NOT_SET;
        /**
         * The WebGL handle for the render buffer object created for this buffer's
         * depth attachment.
         * @type WebGLRenderBuffer
         */
        this._renderBufferID = null;
    }
    /**
     * Value for texture bind locations that have not been explicitly set
     * @constant
     * @type Number
     */
    FrameBuffer.prototype.TEXTURE_LOCATION_NOT_SET = -1;
    /**
     * Returns the name of this buffer.
     * @returns {String}
     */
    FrameBuffer.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the WebGL handle for the texture object holding this buffer's color
     * attachment.
     * @returns {String}
     */
    FrameBuffer.prototype.getTextureID = function () {
        return this._textureID;
    };
    /**
     * Returns the texture unit index where the texture associated with this 
     * framebuffer has been last bound to.
     * @returns {Number}
     */
    FrameBuffer.prototype.getTextureBindLocation = function () {
        return this._textureLocation;
    };
    /**
     * Sets the texture unit index where the texture associated with this framebuffer
     * should be bound to.
     * @param {Number} location
     */
    FrameBuffer.prototype.setTextureBindLocation = function (location) {
        this._textureLocation = location;
    };
    /**
     * Creates the WebGL frame buffer object for this buffer, then creates and 
     * sets up a texture for holding the color attachment and a render buffer 
     * for holding the depth attachment and attaches them to this frame buffer.
     * @param {ManagedGLContext} context
     */
    FrameBuffer.prototype.setup = function (context) {
        // calling setup on a frame buffer that has already been set up has no
        // effect
        if (this._id !== null) {
            return;
        }
        this._id = context.gl.createFramebuffer();
        context.gl.bindFramebuffer(context.gl.FRAMEBUFFER, this._id);
        this._textureID = context.gl.createTexture();
        this._textureLocation = context.bindTexture(this);
        context.gl.texParameteri(context.gl.TEXTURE_2D, context.gl.TEXTURE_MAG_FILTER, context.gl.LINEAR);
        context.gl.texParameteri(context.gl.TEXTURE_2D, context.gl.TEXTURE_MIN_FILTER, context.gl.LINEAR);
        context.gl.texImage2D(context.gl.TEXTURE_2D, 0, context.gl.RGBA, this._width, this._height, 0, context.gl.RGBA, context.gl.UNSIGNED_BYTE, null);
        this._renderBufferID = context.gl.createRenderbuffer();
        context.gl.bindRenderbuffer(context.gl.RENDERBUFFER, this._renderBufferID);
        context.gl.renderbufferStorage(context.gl.RENDERBUFFER, context.gl.DEPTH_COMPONENT16, this._width, this._height);
        context.gl.framebufferTexture2D(context.gl.FRAMEBUFFER, context.gl.COLOR_ATTACHMENT0, context.gl.TEXTURE_2D, this._textureID, 0);
        context.gl.framebufferRenderbuffer(context.gl.FRAMEBUFFER, context.gl.DEPTH_ATTACHMENT, context.gl.RENDERBUFFER, this._renderBufferID);
    };
    /**
     * Binds the frame buffer to the given context. Subsequent rendering will
     * use this frame buffer.
     * @param {ManagedGLContext} context
     */
    FrameBuffer.prototype.bind = function (context) {
        context.gl.bindFramebuffer(context.gl.FRAMEBUFFER, this._id);
    };
    /**
     * Deletes the corresponding WebGL frame buffer object and the objects
     * associated with its attachments.
     * @param {ManagedGLContext} context
     */
    FrameBuffer.prototype.delete = function (context) {
        context.gl.deleteTexture(this._textureID);
        context.gl.deleteRenderbuffer(this._renderBufferID);
        context.gl.deleteFramebuffer(this._id);
        this._id = null;
    };
    // ############################################################################################
    /**
     * @class
     * @param {String} name
     * @param {String} vertexShaderSource
     * @param {String} fragmentShaderSource
     * @param {String} blendType
     * @param {Object.<String, String>} attributeRoles
     */
    function ManagedShader(name, vertexShaderSource, fragmentShaderSource, blendType, attributeRoles) {
        // properties for file resource management
        /**
         * The name of the shader program it can be referred to with later. Has to
         * be unique.
         * @type String
         */
        this._name = name;
        /**
         * The type of blending to be used with this shader. Options:
         * "mix": will overwrite the existing color up to the proportion of the 
         * alpha component of the new color (srcAlpha + (1-srcAlpha)) 
         * "add": will add the color of the existing one (srcAlpha + 1)
         * @type String
         */
        this._blendType = blendType;
        /**
         * The list of shader attribute properties of this shader.
         * @type ShaderAttribute[]
         */
        this._attributes = [];
        /**
         * The list of shader uniforms of this shader.
         * @type ShaderUniform[]
         */
        this._uniforms = [];
        /**
         * The source code of the vertex shader.
         * @type String
         */
        this._vertexShaderSource = vertexShaderSource;
        /**
         * The source code of the fragment shader.
         * @type String
         */
        this._fragmentShaderSource = fragmentShaderSource;
        // properties for WebGL resource management
        /**
         * The associative array of WebGL program IDs belonging to managed contexts 
         * which this program has been associated with. The keys are the names of the managed
         * contexts, and values are the WebGL IDs (handles)
         * @type Object
         */
        this._ids = {};
        this._loadAttributesAndUniforms(attributeRoles);
    }
    /**
     * @param {String} name
     * @returns {Boolean}
     */
    ManagedShader.prototype._hasUniform = function (name) {
        var i;
        for (i = 0; i < this._uniforms.length; i++) {
            if (this._uniforms[i].getName() === name) {
                return true;
            }
        }
        return false;
    };
    /**
     * @param {Object} attributeRoles
     */
    ManagedShader.prototype._loadAttributesAndUniforms = function (attributeRoles) {
        var
                i, j, shaderType,
                sourceLines, words,
                attributeName, attributeSize, attributeRole,
                uniform, uniformNameElements, uniformName, uniformType, uniformArraySize, structFound,
                isNotEmptyString = function (s) {
                    return s !== "";
                };
        for (shaderType = 0; shaderType < 2; shaderType++) {
            switch (shaderType) {
                case 0:
                    sourceLines = this._vertexShaderSource.split("\n");
                    break;
                case 1:
                    sourceLines = this._fragmentShaderSource.split("\n");
                    break;
            }
            for (i = 0; i < sourceLines.length; i++) {
                words = sourceLines[i].split(" ");
                if ((shaderType === 0) && (words[0] === "attribute")) {
                    attributeName = words[2].split(";")[0];
                    switch (words[1]) {
                        case "float":
                            attributeSize = 1;
                            break;
                        case "vec2":
                            attributeSize = 2;
                            break;
                        case "vec3":
                            attributeSize = 3;
                            break;
                        case "vec4":
                            attributeSize = 4;
                            break;
                        default:
                            application.showError("Unknown attribute type: '" + words[1] + "' found in the source of shader: '" + this._name + "'!");
                            return;
                    }
                    attributeRole = attributeRoles[attributeName];
                    if (attributeRole === undefined) {
                        application.showError("Role for attribute named '" + attributeName + "' not found for shader '" + this._name + "'!");
                        return;
                    }
                    this._attributes.push(new ShaderAttribute(attributeName, attributeSize, attributeRole));
                }
                if (words[0] === "uniform") {
                    uniformNameElements = words[2].split(";")[0].split("[");
                    uniformName = uniformNameElements[0];
                    if (this._hasUniform(uniformName) === false) {
                        if (uniformNameElements.length > 1) {
                            uniformArraySize = parseInt(uniformNameElements[1].split("]")[0], 10);
                        } else {
                            uniformArraySize = 0;
                        }
                        uniformType = words[1];
                        if (ShaderUniform.prototype.getVariableTypeFromString(uniformType) === ShaderUniform.prototype.VariableTypes.none) {
                            uniform = new ShaderUniform(uniformName, "struct", uniformArraySize);
                            structFound = false;
                            for (j = 0; j < sourceLines.length; j++) {
                                words = sourceLines[j].split(" ");
                                if (!structFound) {
                                    if ((words[0] === "struct") && (words[1].split("{")[0] === uniformType)) {
                                        structFound = true;
                                    }
                                } else {
                                    words = words.filter(isNotEmptyString);
                                    if ((words.length > 0) && (words[words.length - 1].split(";")[0] === "}")) {
                                        break;
                                    }
                                    if (words.length >= 2) {
                                        uniform.addMember(new ShaderUniform(words[1].split(";")[0], words[0], 0));
                                    }
                                }
                            }
                            this._uniforms.push(uniform);
                        } else {
                            this._uniforms.push(new ShaderUniform(uniformName, uniformType, uniformArraySize));
                        }
                    }
                }
            }
        }
    };
    /**
     * Getter for the _name property.
     * @returns {String}
     */
    ManagedShader.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the WebGL ID of this program valid in the supplied managed context.
     * Error checking is not performed - if there is no valid ID for this context,
     * it will return undefined.
     * @param {ManagedGLContext} context
     * @returns {WebGLProgram}
     */
    ManagedShader.prototype.getIDForContext = function (context) {
        return this._ids[context.getName()];
    };
    /**
     * Returns the array of shader attributes of this shader.
     * @returns {ShaderAttribute[]}
     */
    ManagedShader.prototype.getAttributes = function () {
        return this._attributes;
    };
    /**
     * Returns the name of the optional fallback shader of this shader.
     * @returns {String}
     */
    ManagedShader.prototype.getFallbackShaderName = function () {
        return this._fallback;
    };
    /**
     * Adds the shader resource to be available for the provided managed WebGL
     * context. If it has already been added, does nothing. (as typically this
     * will be called many times, with different {@link RenderableObject}s containing 
     * the shader request it to be added to the context where they are to be
     * drawn) The action is only executed when the shader has been loaded.
     * @param {ManagedGLContext} context
     */
    ManagedShader.prototype.addToContext = function (context) {
        var gl, vertexShader, infoLog, fragmentShader, prog, i;
        if (this._ids[context.getName()] === undefined) {
            gl = context.gl;
            // create and compile vertex shader
            vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, this._vertexShaderSource);
            gl.compileShader(vertexShader);
            // detect and display compilation errors
            if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                infoLog = gl.getShaderInfoLog(vertexShader);
                application.showGraphicsError("Compiling GLSL vertex shader '" + this._vertexShaderFileName + "' failed.", "severe", "More details:\n" + infoLog, gl);
                this._ids[context.getName()] = null;
                return;
            }
            // create and compile fragment shader
            fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, this._fragmentShaderSource);
            gl.compileShader(fragmentShader);
            // detect and display compilation errors
            if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                infoLog = gl.getShaderInfoLog(fragmentShader);
                application.showGraphicsError("Compiling GLSL fragment shader '" + this._fragmentShaderFileName + "' failed.", "severe", "More details:\n" + infoLog, gl);
                this._ids[context.getName()] = null;
                return;
            }
            // create and link shader program
            this._ids[context.getName()] = gl.createProgram();
            prog = this._ids[context.getName()];
            gl.attachShader(prog, vertexShader);
            gl.attachShader(prog, fragmentShader);
            gl.linkProgram(prog);
            // detect and display linking errors
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                infoLog = gl.getProgramInfoLog(prog);
                application.showGraphicsError("Linking GLSL shader '" + this._name + "' failed.", "severe", "More details: " + infoLog, gl);
                gl.deleteProgram(prog);
                this._ids[context.getName()] = null;
                return;
            }
            // cache uniform locations
            for (i = 0; i < this._uniforms.length; i++) {
                this._uniforms[i].setLocation(context, this);
            }
            // add the created shader to the context's managed resources list
            context.addShader(this);
        }
    };
    /**
     * Clears all previous bindings to managed WebGL contexts.
     */
    ManagedShader.prototype.clearContextBindings = function () {
        this._ids = {};
    };
    /**
     * Sets the blending function in the supplied managed context according to the
     * blending type of this shader.
     * @param {ManagedGLContext} context
     */
    ManagedShader.prototype.setBlending = function (context) {
        if (this._blendType === "mix") {
            context.gl.blendFunc(context.gl.SRC_ALPHA, context.gl.ONE_MINUS_SRC_ALPHA);
        } else if (this._blendType === "add") {
            context.gl.blendFunc(context.gl.SRC_ALPHA, context.gl.ONE);
        }
    };
    /**
     * Assigns the uniforms that have an associated value function in 
     * uniformValueFunctions, by calculating the value using those functions.
     * @param {ManagedGLContext} context The context in which the assignment needs
     * to happen.
     * @param {Object} uniformValueFunctions An associative array containing 
     * functions to calculate the values of uniforms, with the names of the uniforms
     * as keys.
     */
    ManagedShader.prototype.assignUniforms = function (context, uniformValueFunctions) {
        var i;
        context.setCurrentShader(this);
        for (i = 0; i < this._uniforms.length; i++) {
            if (uniformValueFunctions[this._uniforms[i].getName()] !== undefined) {
                this._uniforms[i].setValue(context, this, uniformValueFunctions[this._uniforms[i].getName()]);
            }
        }
    };
    /**
     * Binds the appropriate vertex buffers to the indices of the vertex 
     * attributes that this shader has.
     * @param {ManagedGLContext} context
     */
    ManagedShader.prototype.bindVertexBuffers = function (context) {
        var i;
        for (i = 0; i < this._attributes.length; i++) {
            context.getVertexBuffer(this._attributes[i].name).bind(context, this);
        }
    };
    /**
     * If the shader has a uniform array variable with the given name, this will return the length
     * of that array, otherwise it will return 0.
     * @param {String} uniformName
     * @returns {Number}
     */
    ManagedShader.prototype.getUniformArrayLength = function (uniformName) {
        var i;
        for (i = 0; i < this._uniforms.length; i++) {
            if (this._uniforms[i].getName() === uniformName) {
                return this._uniforms[i].getArraySize();
            }
        }
        return 0;
    };
    /**
     * Returns what types of textures does this shader need to be bound, based on the names of its uniform sampler variables.
     * @returns {Array}
     */
    ManagedShader.prototype.getTextureTypes = function () {
        var i, textureType, result = [];
        for (i = 0; i < this._uniforms.length; i++) {
            textureType = this._uniforms[i].getTextureType();
            if (textureType) {
                result.push(textureType);
            }
        }
        return result;
    };
    // ############################################################################################
    /**
     * Creates a managed WebGL context for the given HTML5 canvas element.
     * @class Adds higher level management functions to the WebGLRenderingContext
     * class. {@link Texture}, {@link Cubemap}, {@link Shader} and
     * {@link Model} resources can be linked to it, and can set up the vertex
     * buffers according to the linked model resources.
     * @extends AsyncResource
     * @param {String} name The name of the context.
     * @param {HTMLCanvasElement} canvas The canvas for which the context is to be
     * created.
     * @param {Boolean} [antialiasing=false] Whether antialising should be turned on for
     * this context. If the WebGL implementation does not support antialiasing, this
     * will have no effect.
     * @param {String} filtering What kind of texture filtering should be used for
     * 2D textures. Supported values are: bilinear, trilinear, anisotropic (which
     * will be 4:1)
     * @returns {ManagedGLContext}
     */
    function ManagedGLContext(name, canvas, antialiasing, filtering) {
        var gl_, contextParameters;
        asyncResource.AsyncResource.call(this);
        /**
         * The name of the context by which it can be referred to.
         * @type String
         */
        this._name = name;
        /**
         * The contained basic WebGL rendering context.
         * @type WebGLRenderingContext
         */
        this.gl = null;
        /**
         * Whether antialiasing is enabled for the WebGL context.
         * @type Boolean
         */
        this._antialiasing = (antialiasing === true);
        /**
         * What filtering is used for 2D textures. Supported values are: bilinear,
         * trilinear and anisotropic. Attempting to create the context with anisotropic
         * filtering will cause it to probe if the functionality is available, and will
         * set 4:1 anisotropic filtering up if so, otherwise revert back to trilinear
         * filtering.
         * @type String
         */
        this._filtering = filtering;
        /**
         * Holder for the handle of the anisotropic filter WebGL extension, should it
         * be needed.
         * @type Object
         */
        this._anisotropicFilter = null;
        /**
         * The list of associated shaders. This needs to be stored in order to bind
         * the vertex buffer objects to the corresponding attributes of the shaders
         * after the buffers are created. However, the shaders are created and 
         * managed using a {@link ResourceManager}, and this context only references 
         * them.
         * A VBO is created for each attribute with a different name and then bound
         * to its index, therefore attributes with tha same name contained in these
         * shaders must share the same index as well.
         * @type Shader[]
         */
        this._shaders = [];
        /**
         * The list of associated models. This needs to be stored in order to fill 
         * the vertex buffer objects with data from these models when the buffers 
         * are created. <br/>
         * The model objects are created and managed using a {@link ResourceManager}, 
         * and this context only references them.
         * @type Model[]
         */
        this._models = [];
        /**
         * The associative array of vertex buffer objects, stored by their names 
         * (which equal the names of their corresponding attributes) as the keys.
         * @type Object
         */
        this._vertexBuffers = null;
        /**
         * The list of the vertex buffer objects bound to each vertex attribute
         * array index. (the index in the array corresponds to the vertex attribute
         * array index)
         * @type VertexBuffer[]
         */
        this._boundVertexBuffers = [];
        /**
         * The associative array of frame buffer objects, stored by their names 
         * (which equal the names of their corresponding attributes) as the keys.
         * @type Object
         */
        this._frameBuffers = {};
        /**
         * A reference to the currently used shader in order to quickly dismiss 
         * calls that aim to set the same again.
         * @type ManagedShader
         */
        this._currentShader = null;
        /**
         * The list of references to the currently bound textures in order to 
         * quickly dismiss calls that aim to bind the same texture to the same place
         * again. The indices mark which texture unit index the texture is bound 
         * to.
         * @type Texture[]
         */
        this._boundTextures = [];
        /**
         * The maximum number of simultaneously bound textures supported by the
         * WebGL implementation.
         * @type Number
         */
        this._maxBoundTextures = 0;
        /**
         * When all texture unit places has been taken, new textures will be bound
         * to this rotating index so that subsequent binds will not replace each other
         * on the same unit.
         * @type Number
         */
        this._nextTextureBindLocation = 0;
        /**
         * The maximum supported 2D texture size. Attempting to add a texture to
         * the context that is bigger should fail.
         * @type Number
         */
        this._maxTextureSize = 0;
        /**
         * The maximum supported cubemap texture size. Attempting to add a 
         * cubemap texture to the context that is bigger should fail.
         * @type Number
         */
        this._maxCubemapSize = 0;
        /**
         * The maximum supported render buffer size. Attempting to create a 
         * render buffer in the context that is bigger should fail.
         * @type Number
         */
        this._maxRenderbufferSize = 0;
        /**
         * The number of supported vertex attributes.
         * @type Number
         */
        this._maxVertexAttributes = 0;
        /**
         * The number of supported uniform vectors in the vertex shader.
         * @type Number
         */
        this._maxVertexShaderUniforms = 0;
        /**
         * The number of supported uniform vectors in the fragment shader.
         * @type Number
         */
        this._maxFragmentShaderUniforms = 0;
        /**
         * The number of supported varying vectors in shader programs.
         * @type Number
         */
        this._maxVaryings = 0;
        application.log("Initializing WebGL context...", 1);
        // creating the WebGLRenderingContext
        contextParameters = {alpha: true, antialias: antialiasing};
        // some implementations throw an exception, others don't, but all return null
        // if the creation fails, so handle that case
        try {
            // Try to grab the standard context.
            this.gl = canvas.getContext("webgl", contextParameters);
        } catch (ignore) {
        }
        // if creating a normal context fails, fall back to experimental, but notify the user
        if (!this.gl) {
            application.log("Initializing a regular context failed, initializing experimental context...", 1);
            contextParameters.alpha = false;
            try {
                this.gl = canvas.getContext("experimental-webgl", contextParameters);
            } catch (ignore) {
            }
            if (!this.gl) {
                application.showError("Unable to initialize WebGL.", "critical",
                        "It looks like your device, browser or graphics drivers do not " +
                        "support web 3D graphics. Make sure your browser and graphics " +
                        "drivers are updated to the latest version, and you are using " +
                        "a modern web browser (Firefox or Chrome are recommended).\n" +
                        "Please note that some phones or handheld devices do not have 3D " +
                        "web capabilities, even if you use the latest software.");
                return;
            }
            application.showError("Your device appears to only have experimental WebGL (web based 3D) support.",
                    undefined, "This application relies on 3D web features, and without full support, " +
                    "the graphics of the application might be displayed with glitches or not at all. " +
                    "If you experience problems, it is recommended to use lower graphics quality settings.");
        }
        gl_ = this.gl;
        if (antialiasing && !(gl_.getContextAttributes().antialias)) {
            application.showGraphicsError("Antialiasing is enabled in graphics settings but it is not supported.",
                    "minor", "Your graphics driver, browser or device unfortunately does not support antialiasing. To avoid " +
                    "this error message showing up again, disable antialiasing in the graphics settings or try " +
                    "running the application in a different browser. Antialiasing will not work, but otherwise this " +
                    "error will have no consequences.", gl_);
        }
        // save the information about WebGL limits
        this._maxBoundTextures = gl_.getParameter(gl_.MAX_TEXTURE_IMAGE_UNITS);
        this._maxTextureSize = gl_.getParameter(gl_.MAX_TEXTURE_SIZE);
        this._maxCubemapSize = gl_.getParameter(gl_.MAX_CUBE_MAP_TEXTURE_SIZE);
        this._maxRenderbufferSize = gl_.getParameter(gl_.MAX_RENDERBUFFER_SIZE);
        this._maxVertexAttributes = gl_.getParameter(gl_.MAX_VERTEX_ATTRIBS);
        this._maxVertexShaderUniforms = gl_.getParameter(gl_.MAX_VERTEX_UNIFORM_VECTORS);
        this._maxFragmentShaderUniforms = gl_.getParameter(gl_.MAX_FRAGMENT_UNIFORM_VECTORS);
        this._maxVaryings = gl_.getParameter(gl_.MAX_VARYING_VECTORS);
        application.log("WebGL context successfully created.\n" +
                " Available texture units: " + this._maxBoundTextures + "\n" +
                " Maximum texture size: " + this._maxTextureSize + "\n" +
                " Maximum cubemap size: " + this._maxCubemapSize + "\n" +
                " Maximum renderbuffer size: " + this._maxRenderbufferSize + "\n" +
                " Available vertex attributes: " + this._maxVertexAttributes + "\n" +
                " Available vertex shader uniform vectors: " + this._maxVertexShaderUniforms + "\n" +
                " Available fragment shader uniform vectors: " + this._maxFragmentShaderUniforms + "\n" +
                " Available varying vectors: " + this._maxVaryings, 1);
        // is filtering is set to anisotropic, try to grab the needed extension. If that fails,
        // fall back to trilinear filtering.
        if (this._filtering === "anisotropic") {
            application.log("Initializing anisotropic filter...", 1);
            this._anisotropicFilter = gl_.getExtension("EXT_texture_filter_anisotropic");
            if (this._anisotropicFilter === null) {
                application.log("Anisotropic filtering not available. Falling back to trilinear filtering.", 1);
                this._filtering = "trilinear";
            } else {
                application.log("Anisotropic filtering successfully initialized.", 1);
            }
        }
        // some basic settings on the context state machine
        gl_.clearDepth(1.0);
        gl_.colorMask(true, true, true, true);
        gl_.enable(gl_.DEPTH_TEST);
        gl_.depthFunc(gl_.LEQUAL);
        gl_.enable(gl_.CULL_FACE);
        gl_.cullFace(gl_.BACK);
        gl_.frontFace(gl_.CCW);
    }
    ManagedGLContext.prototype = new asyncResource.AsyncResource();
    ManagedGLContext.prototype.constructor = ManagedGLContext;
    /**
     * Returns the name of this managed context.
     * @returns {String}
     */
    ManagedGLContext.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the type of currently set texture filtering.
     * @returns {String}
     */
    ManagedGLContext.prototype.getFiltering = function () {
        return this._filtering;
    };
    /**
     * Returns the extension object for anisotropic texture filtering.
     * @returns {Object}
     */
    ManagedGLContext.prototype.getAnisotropicFilter = function () {
        return this._anisotropicFilter;
    };
    /**
     * Adds the shader reference to the list of shaders to be used when the vertex
     * buffer objects are created and bound to shader attributes. This method only
     * appends the reference, in order to perform the necessary preparation of the 
     * shader (compiling, linking...) and avoid adding the same shader multiple
     * times, the shader's addToContext() method needs to be called instead!
     * @param {ManagedShader} shader
     */
    ManagedGLContext.prototype.addShader = function (shader) {
        this._shaders.push(shader);
        this.resetReadyState();
    };
    /**
     * Adds the model reference to the list of models to be used when the vertex
     * buffer objects are created and filled with data. 
     * @param {Model} model
     */
    ManagedGLContext.prototype.addModel = function (model) {
        this._models.push(model);
        this.resetReadyState();
    };
    /**
     * Returns the vertex buffer with the given name, if such exists. Otherwise
     * returns undefined.
     * @param {String} name
     * @returns {VertexBuffer}
     */
    ManagedGLContext.prototype.getVertexBuffer = function (name) {
        return this._vertexBuffers[name];
    };
    /**
     * Adds the vertex buffer object given as parameter.
     * @param {VertexBuffer} vertexBuffer
     */
    ManagedGLContext.prototype.addVertexBuffer = function (vertexBuffer) {
        if (this._vertexBuffers[vertexBuffer.getName()] === undefined) {
            this._vertexBuffers[vertexBuffer.getName()] = vertexBuffer;
        }
    };
    /**
     * Returns the vertex buffer which is currently bound to the passed vertex
     * attribute index.
     * @param {Number} attributeLocation
     * @returns {VertexBuffer}
     */
    ManagedGLContext.prototype.getBoundVertexBuffer = function (attributeLocation) {
        return this._boundVertexBuffers[attributeLocation];
    };
    /**
     * Sets the vertex buffer as the currently bound buffer for the passed vertex
     * attribute index. (does not actually bind the buffer!)
     * @param {Number} attributeLocation
     * @param {VertexBuffer} vertexBuffer
     */
    ManagedGLContext.prototype.setBoundVertexBuffer = function (attributeLocation, vertexBuffer) {
        this._boundVertexBuffers[attributeLocation] = vertexBuffer;
    };
    /**
     * Passes the data to the stored vertex buffer objects.
     * @param {Object} data The data to store in the vertex buffers. It has to be
     * an associative array storing the Float32Arrays of the data organized by the
     * role (String) of the vertex buffer they are to be stored in as the key.
     * @param {Number} startIndex The starting index in the buffers from where to
     * set the data.
     */
    ManagedGLContext.prototype.setVertexBufferData = function (data, startIndex) {
        var vbName;
        for (vbName in this._vertexBuffers) {
            if (this._vertexBuffers.hasOwnProperty(vbName)) {
                if (data[this._vertexBuffers[vbName].getRole()] !== undefined) {
                    this._vertexBuffers[vbName].setData(data[this._vertexBuffers[vbName].getRole()], startIndex);
                }
            }
        }
    };
    /**
     * Based on the stored shader references, creates a vertex buffer object to each 
     * attribute with a unique name, fills them with data using the stored model
     * references and then binds the vertex buffer objects to the corresponding
     * attribute indices.
     */
    ManagedGLContext.prototype.setupVertexBuffers = function () {
        var i, j, vbName, sumVertices, shaderAttributes, bufferSize;
        if (this.isReadyToUse() === true) {
            return;
        }
        // delete possibly previously created buffers
        for (vbName in this._vertexBuffers) {
            if (this._vertexBuffers.hasOwnProperty(vbName)) {
                this._vertexBuffers[vbName].delete(this);
            }
        }
        // counting the number of vertices we need to put into the vertex buffers
        sumVertices = 0;
        for (i = 0; i < this._models.length; i++) {
            sumVertices = sumVertices + this._models[i].getBufferSize(this);
        }
        // creating and loading an index buffer (just with ascending numbers)
        // so that drawElements can also be used for rendering
        // this code can be useful later, when actual indexed rendering will be supported
        /*var indexBufferData = new Array(sumVertices);
         for (i = 0; i < sumVertices; i++) {
         indexBufferData[i] = i;
         }
         var indexBuffer = this.gl.createBuffer();
         this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
         this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexBufferData), this.gl.STATIC_DRAW);*/
        // creating a Float32Array of the appropriate size for each needed buffer
        this._vertexBuffers = {};
        for (i = 0; i < this._shaders.length; i++) {
            shaderAttributes = this._shaders[i].getAttributes();
            for (j = 0; j < shaderAttributes.length; j++) {
                this.addVertexBuffer(new VertexBuffer(shaderAttributes[j].name, shaderAttributes[j].role, shaderAttributes[j].size, sumVertices));
            }
        }
        // filling the buffer data arrays from model data
        bufferSize = 0;
        for (i = 0; i < this._models.length; i++) {
            for (j = this._models[i].getMinLOD(); j <= this._models[i].getMaxLOD(); j++) {
                bufferSize += this._models[i].loadToVertexBuffers(this, bufferSize, j);
            }
        }
        // load the data to GPU memory and bind the attributes of the shaders with 
        // the corresponding VBOs
        for (vbName in this._vertexBuffers) {
            if (this._vertexBuffers.hasOwnProperty(vbName)) {
                this._vertexBuffers[vbName].loadToGPUMemory(this);
            }
        }
        // bind the vertex buffers to the vertex attribute indices in each shader
        // and save this bindings for later use when a shader is selected
        this._currentShader = null;
        for (i = 0; i < this._shaders.length; i++) {
            this.setCurrentShader(this._shaders[i]);
        }
    };
    /**
     * Returns the frame buffer with the given name, if such exists. Otherwise
     * returns undefined.
     * @param {String} name
     * @returns {FrameBuffer}
     */
    ManagedGLContext.prototype.getFrameBuffer = function (name) {
        return this._frameBuffers[name];
    };
    /**
     * Adds the frame buffer object given as parameter.
     * @param {FrameBuffer} frameBuffer
     */
    ManagedGLContext.prototype.addFrameBuffer = function (frameBuffer) {
        if (this._frameBuffers[frameBuffer.getName()] === undefined) {
            this._frameBuffers[frameBuffer.getName()] = frameBuffer;
            if (this.isReadyToUse()) {
                this._frameBuffers[frameBuffer.getName()].setup(this);
            }
        }
    };
    /**
     * Sets up all the previously added frame buffers.
     */
    ManagedGLContext.prototype.setupFrameBuffers = function () {
        var fbName;
        for (fbName in this._frameBuffers) {
            if (this._frameBuffers.hasOwnProperty(fbName)) {
                this._frameBuffers[fbName].setup(this);
            }
        }
    };
    /**
     * Deletes all the previously added frame buffers.
     */
    ManagedGLContext.prototype.clearFrameBuffers = function () {
        var fbName;
        for (fbName in this._frameBuffers) {
            if (this._frameBuffers.hasOwnProperty(fbName)) {
                this._frameBuffers[fbName].delete(this);
            }
        }
        this._frameBuffers = {};
    };
    /**
     * Does all preparations for the previously added resources (shader, models,
     * frame buffers...) that are needed to be able to start rendering. After 
     * this method, the context is ready to render any resources that have been 
     * added to it up to this point.
     */
    ManagedGLContext.prototype.setup = function () {
        this.setupVertexBuffers();
        this.setupFrameBuffers();
        this.setToReady();
    };
    /**
     * Sets the stored framebuffer with the passed name as the current framebuffer
     * to render to. If no name (or any falsy value) is given, sets the screen 
     * as the current rendering target.
     * @param {String} [name]
     */
    ManagedGLContext.prototype.setCurrentFrameBuffer = function (name) {
        if (name) {
            this._frameBuffers[name].bind(this);
        } else {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        }
    };
    /**
     * Returns the currently set shader.
     * @returns {ManagedShader}
     */
    ManagedGLContext.prototype.getCurrentShader = function () {
        return this._currentShader;
    };
    /**
     * Sets up the provided shader for usage within the provided scene.
     * @param {ManagedShader} shader The shader to set as current.
     */
    ManagedGLContext.prototype.setCurrentShader = function (shader) {
        if (this._currentShader !== shader) {
            application.log("Switching to shader: " + shader.getName(), 3);
            this.gl.useProgram(shader.getIDForContext(this));
            shader.setBlending(this);
            shader.bindVertexBuffers(this);
            this._currentShader = shader;
        }
    };
    /**
     * Binds the given {@link Texture} or {@link Cubemap} resource or the texture
     * associated to the given {@link FrameBuffer} resource to the given texture unit index.
     * @param {ManagedTexture|ManagedCubemap|FrameBuffer} texture The resource to bind for rendering.
     * @param {Number} place To which activeTexture place is the texture to be bound.
     * If omitted, the texture will be bound to any free unit if one is available, and 
     * to a unit with a rotating index, if no free units are available. If a specific
     * index is given, that index will be reserved for this texture, and will not be
     * automatically assigned during later binds.
     * @param {Boolean} reservePlace If true, an automatic index will be bound as if 
     * no index was specified, but that index will be reserved for the texture.
     * @return {Number} The texture unit index the texture was bound to.
     */
    ManagedGLContext.prototype.bindTexture = function (texture, place, reservePlace) {
        // if a specific place was given for the bind, reserve that 
        // (or the automatically found) place for this texture
        var reserved = (place !== undefined) || reservePlace;
        // if needed, determine the bind locaton automatically
        if (place === undefined) {
            // find out if there is a preferred bind location
            place = texture.getTextureBindLocation(this);
            // if there is no preferred location or another texture is bound to the preferred location,
            // find the first free place, and bind the texture there
            if ((place === undefined) || (place === FrameBuffer.prototype.TEXTURE_LOCATION_NOT_SET) || (this._boundTextures[place].texture !== texture)) {
                place = 0;
                while ((place < this._maxBoundTextures) && (place < this._boundTextures.length) && (this._boundTextures[place] !== undefined)) {
                    place++;
                }
                // if there is no free space left, bind to a rotating location, excluding the reserved
                // locations
                if (place === this._maxBoundTextures) {
                    while (this._boundTextures[this._nextTextureBindLocation].reserved) {
                        this._nextTextureBindLocation = (this._nextTextureBindLocation + 1) % this._maxBoundTextures;
                    }
                    place = this._nextTextureBindLocation;
                    this._nextTextureBindLocation = (this._nextTextureBindLocation + 1) % this._maxBoundTextures;
                }
            }
        }
        // only bound to it the given texture if currenty it is unbound or a different texture is bound to it
        if (!this._boundTextures[place] || (this._boundTextures[place].texture !== texture)) {
            // make the selected texture unit active
            this.gl.activeTexture(this.gl.TEXTURE0 + place);
            if (texture instanceof ManagedTexture) {
                application.log("Binding texture: '" + texture.getName() + "' to place " + place + (reserved ? ", reserving place." : "."), 3);
                this.gl.bindTexture(this.gl.TEXTURE_2D, texture.getIDForContext(this));
                texture.setTextureBindLocation(this, place);
            } else
            if (texture instanceof ManagedCubemap) {
                application.log("Binding cubemap texture: '" + texture.getName() + "' to place " + place + (reserved ? ", reserving place." : "."), 3);
                this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, texture.getIDForContext(this));
                texture.setTextureBindLocation(this, place);
            } else
            if (texture instanceof FrameBuffer) {
                application.log("Binding framebuffer texture: '" + texture.getName() + "' to place " + place + (reserved ? ", reserving place." : "."), 3);
                this.gl.bindTexture(this.gl.TEXTURE_2D, texture.getTextureID());
                texture.setTextureBindLocation(place);
            } else {
                application.showError("Cannot set object: '" + texture.toString() + "' as current texture, because it is not of an appropriate type.");
            }
            this._boundTextures[place] = {texture: texture, reserved: reserved};
        }
        // make sure the reserve state is updated even if no bind happened
        if (this._boundTextures[place].reserved !== reserved) {
            this._boundTextures[place].reserved = reserved;
            application.log((reserved ? "Reserved" : "Freed") + " texture unit index " + place + ".", 3);
        }
        return place;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        TextureFiltering: TextureFiltering,
        getUniformName: ShaderUniform.prototype.getUniformName,
        ManagedTexture: ManagedTexture,
        ManagedCubemap: ManagedCubemap,
        ManagedShader: ManagedShader,
        FrameBuffer: FrameBuffer,
        ManagedGLContext: ManagedGLContext
    };

});