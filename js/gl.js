"use strict";

/**
 * @fileOverview This file contains wrapper classes for accessing WebGL 
 * functionality and manage the corresponding resources.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1-dev
 */

/**********************************************************************
 Copyright 2014 Krisztián Nagy
 
 This file is part of Interstellar Armada.
 
 Interstellar Armada is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 Interstellar Armada is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with Interstellar Armada.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

Application.createModule({name: "GL",
    dependencies: [
        {module: "Resource", from: "resource.js"},
        {module: "Egom", from: "egom.js"}]}, function () {
    // create a reference to the used modules in the local scope for cleaner and
    // faster access
    var Resource = Application.Resource.Resource;
    var Egom = Application.Egom;

    /**
     * Creates a new Texture object.
     * @class Represents a 2D texture resource.
     * @extends Resource
     * @param {String} filename The name of file from which the texture resource 
     * is to be loaded. The constructor itself does not initiate the loading.
     * @param {Boolean} [useMipmap=true] Whether mipmapping should be used with
     * this texture.
     */
    function Texture(filename, useMipmap) {
        Resource.call(this);
        // properties for file resource management
        /**
         * The name of the file where the texture resides. It actually contains the
         * whole path relative to the site root.
         * @name Texture#_filename
         * @type String
         */
        this._filename = filename;
        /**
         * Whether mipmapping should be used with this texture.
         * @name Texture#_mipmap
         * @type Boolean
         */
        this._mipmap = (useMipmap !== undefined) ? useMipmap : true;
        /**
         * An Image object to manage the loading of the texture from file.
         * @name Texture#_image
         * @type Image
         */
        this._image = new Image();
        // properties for WebGL resource management
        /**
         * The associative array of WebGL texture IDs belonging to managed contexts 
         * which this texture has been associated with. The keys are the names of the managed
         * contexts, and values are the WebGL IDs (handles)
         * @name Texture#_ids
         * @type Object
         */
        this._ids = new Object();
    }

    // as it is an asynchronously loaded resource, we set the Resource as parent
    // class to make handling easier
    Texture.prototype = new Resource();
    Texture.prototype.constructor = Texture;

    /**
     * Getter for the _filename property.
     * @returns {String}
     */
    Texture.prototype.getFilename = function () {
        return this._filename;
    };

    /**
     * Returns the WebGL ID of this texture valid in the supplied managed context.
     * Error checking is not performed - if there is no valid ID for this context,
     * it will return undefined.
     * @param {ManagedGLContext} context
     * @returns {WebGLTexture}
     */
    Texture.prototype.getIDForContext = function (context) {
        return this._ids[context.getName()];
    };

    /**
     * Initiates an asynchronous request to load the texture from file. When the
     * loading finishes, the texture {@link Resource} is marked ready to use and 
     * the potentially queued actions are executed.
     */
    Texture.prototype.requestLoadFromFile = function () {
        if (this.isReadyToUse() === false) {
            var self = this;
            // when loaded, set the resource to ready and execute queued functions
            this._image.onload = function () {
                self.setToReady();
            };
            // setting the src property will automatically result in an asynchronous
            // request to grab the texture file
            this._image.src = this._filename;
        }
    };

    /**
     * Adds the texture resource to be available for the provided managed WebGL
     * context. If it has already been added, does nothing. (as typically this
     * will be called many times, with different {@link VisualObject}s containing 
     * the texture request it to be added to the context where they are to be
     * drawn) The action is only executed when the texture has been loaded.
     * @param {ManagedGLContext} context
     */
    Texture.prototype.addToContext = function (context) {
        this.executeWhenReady(function () {
            if (this._ids[context.getName()] === undefined) {
                var gl = context.gl;
                this._ids[context.getName()] = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this._ids[context.getName()]);
                // Upload the image into the texture.
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
                // Set the parameters so we can render any size image.
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                if (this._mipmap === false) {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                } else {
                    if (context.getFiltering() === "bilinear") {
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                    } else if (context.getFiltering() === "trilinear") {
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                    } else if (context.getFiltering() === "anisotropic") {
                        gl.texParameterf(gl.TEXTURE_2D, context.getAnisotropicFilter().TEXTURE_MAX_ANISOTROPY_EXT, 4);
                    }
                    gl.generateMipmap(gl.TEXTURE_2D);
                }
            }
        });
    };

    /**
     * Clears all previous bindings to managed WebGL contexts.
     */
    Texture.prototype.clearContextBindings = function () {
        this._ids = new Object();
    };

    /**
     * Creates a new Cubemap object.
     * @class Represents a cube mapped texture resource.
     * @extends Resource
     * @param {String} name The name of cubemap resource
     * @param {String[6]} imageURLs An array containing the URLs of the 6 faces of
     * the cubemapped texture. The order of the pictures has to be X,Y,Z and within
     * that, always positive first.
     */
    function Cubemap(name, imageURLs) {
        Resource.call(this);
        // properties for file resource management
        /**
         * The name by wich this resource will be referred to. (has to be unique for
         * each instance)
         * @name Cubemap#_name
         * @type String
         */
        this._name = name;
        /**
         * The URLs for each texture image of the 6 faces of the cubemap. Order:
         * X+,X-,Y+,Y-,Z+,Z-. The path is relative to the site root.
         * @name Cubemap#_imageURLs
         * @type String[6]
         */
        this._imageURLs = imageURLs;
        /**
         * 6 Image objects to manage the loading of the 6 textures of the faces from
         * their source files.
         * @name Cubemap#_images
         * @type Image[6]
         */
        this._images = new Array(6);
        for (var i = 0; i < 6; i++) {
            this._images[i] = new Image();
        }
        // properties for WebGL resource management
        /**
         * The associative array of WebGL cubemap IDs belonging to managed contexts 
         * which this cubemap has been associated with. The keys are the names of the managed
         * contexts, and values are the WebGL IDs (handles)
         * @name Cubemap#_ids
         * @type Object
         */
        this._ids = new Object();
    }

    // as it is an asynchronously loaded resource, we set the Resource as parent
    // class to make handling easier
    Cubemap.prototype = new Resource();
    Cubemap.prototype.constructor = Cubemap;

    /**
     * Getter for the property _name.
     * @returns {String}
     */
    Cubemap.prototype.getName = function () {
        return this._name;
    };

    /**
     * Returns the WebGL ID of this cubemap valid in the supplied managed context.
     * Error checking is not performed - if there is no valid ID for this context,
     * it will return undefined.
     * @param {ManagedGLContext} context
     * @returns {WebGLTexture}
     */
    Cubemap.prototype.getIDForContext = function (context) {
        return this._ids[context.getName()];
    };

    /**
     * Initiates asynchronous requests to load the face textures from their source
     * files. When the loading finishes, the cubemap {@link Resource} is marked 
     * ready to use and the potentially queued actions are executed.
     */
    Cubemap.prototype.requestLoadFromFile = function () {
        if (this.isReadyToUse() === false) {
            var facesLoaded = 0;
            var self = this;
            for (var i = 0; i < 6; i++) {
                // when all faces loaded, set the resource to ready and execute queued functions
                this._images[i].onload = function () {
                    facesLoaded += 1;
                    if (facesLoaded === 6) {
                        self.setToReady();
                    }
                };
                // setting the src property will automatically result in an asynchronous
                // request to grab the texture file
                this._images[i].src = this._imageURLs[i];
            }
        }
    };

    /**
     * Adds the cubemap resource to be available for the provided managed WebGL
     * context. If it has already been added, does nothing. (as this might be called 
     * multiple times, with different {@link VisualObject}s containing 
     * the cubemap request it to be added to the context where they are to be
     * drawn) The action is only executed when the cubemap has been loaded.
     * @param {ManagedGLContext} context
     */
    Cubemap.prototype.addToContext = function (context) {
        this.executeWhenReady(function () {
            if (this._ids[context.getName()] === undefined) {
                var gl = context.gl;
                this._ids[context.getName()] = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, this._ids[context.getName()]);

                // Set the parameters so we can render any size image.
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

                var type = [
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
                ];

                // Upload the images into the texture.
                for (var i = 0; i < 6; i++) {
                    gl.texImage2D(type[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._images[i]);
                }
            }
        });
    };

    /**
     * Clears all previous bindings to managed WebGL contexts.
     */
    Cubemap.prototype.clearContextBindings = function () {
        this._ids = new Object();
    };

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
         * @name ShaderUniform#_name
         * @type String
         */
        this._name = name;
        /**
         * The type of variable this uniform is, from an enumeration of supported
         * types. This is used to determine the appropriate assignment function.
         * @see ShaderUniform#VariableTypes
         * @name ShaderUniform#_type
         */
        this._type = this.getVariableTypeFromString(type);
        /**
         * The length of the array in case this uniform is declared as an array in
         * GLSL. Only float and struct arrays are supported so far.
         * @name ShaderUniform#_arraySize
         * @type Number
         */
        this._arraySize = arraySize || 0;
        /**
         * If the uniform is of struct type, other ShaderUniform instances represent
         * its members (and setting it will set the members instead). The members
         * are stored in this array.
         * @name ShaderUniform#_members
         * @type ShaderUniform[]
         */
        this._members = (this._type === this.VariableTypes.struct) ? new Array() : null;
        // properties for WebGL resource management
        /**
         * The associative array containing the locations of this uniform variable
         * belonging to different managed WebGL contexts. The keys are the names of the managed
         * contexts, and values are the locations.
         * @name ShaderUniform#_locations
         * @type Object
         */
        this._locations = new Object();
    }

    /**
     * Enumeration defining the available (supported) variables types of uniforms.
     * @name ShaderUniform#VariableTypes
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
                bool: 9
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
            Application.showError("Attempting to add a member to uniform " + this._name + ", which is not of struct type!");
        }
    };

    /**
     * Gets the location of the uniform in the supplied context and stores it in a
     * member for faster reference with getLocation later.
     * @param {ManagedGLContext} context
     * @param {Shader} shader The shader which this uniform belongs to.
     */
    ShaderUniform.prototype.setLocation = function (context, shader) {
        this._locations[context.getName()] = context.gl.getUniformLocation(shader.getIDForContext(context), this._name);
    };

    /**
     * Gets the location of this uniform valid in the supplied context. The location
     * has to be grabbed from the context with a setLocation prior to the usage of
     * this, otherwise it will return undefined!
     * @param {ManagedGLContext} context
     * @returns {WebGLUniformLocation}
     */
    ShaderUniform.prototype.getLocation = function (context) {
        return this._locations[context.getName()];
    };

    /**
     * Sets the value of the shader in the specified GL context to the return value
     * of the passed value function. Passing a function makes sure whatever 
     * calculations need to take place, they are (can be) calculated right before 
     * the uniform assignment if necessary.
     * @param {ManagedGLContext} context The managed GL context
     * @param {Shader} shader The shader which this uniform belongs to.
     * @param {Function} valueFunction The function to calculate the uniform value.
     * The return type of this function should be appropriate to the uniform type.
     * For structs, it needs to return an Object with properties which have names
     * equal to the names of the members of the struct and the values are of 
     * appropriate type for the corresponding member.
     * @param {String} locationPrefix For uniform struct members, this string has to
     * contain the prefix that needs to be appended before their name to get their
     * access string to grab their location from the GL context. E.g. for 
     * "lights[3].color", the name would be "color" and so the prefix should be
     * "lights[3]"
     */
    ShaderUniform.prototype.setValue = function (context, shader, valueFunction, locationPrefix) {
        var gl = context.gl;
        // calculate the value that needs to be assigned
        var value = valueFunction();
        var location;
        // get the location
        if (locationPrefix !== undefined) {
            // If there is a prefix, the location needs to be grabbed right from GL.
            // The prefix might include array indices, since a single ShaderUniform
            // can represent a whole array of structs.
            location = gl.getUniformLocation(shader.getIDForContext(context), locationPrefix + this._name);
        } else {
            // if possible, just get the previously stored location
            location = this.getLocation(context);
        }
        var i, j;
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
                                var memberName = this._members[j]._name;
                                this._members[j].setValue(context, shader, function () {
                                    return value[i][memberName];
                                }, this._name + "[" + i + "].");
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
     * Creates a new vertex buffer object.
     * @class A wrapper object that represents a WebGL vertex buffer object.
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
         * @name VertexBuffer#_name
         * @type String
         */
        this._name = name;
        /**
         * The usage role of the data stored in this buffer. This will determine
         * what data this buffer gets filled when grabbing the data from the 3D
         * model resources
         * @name VertexBuffer#_role
         * @type String.
         */
        this._role = role;
        /**
         * The number of (Float32) components in one item of this buffer. E.g. for
         * buffer storing vec2 elements, set to 2.
         * @name VertexBuffer#_vectorSize
         * @type Number
         */
        this._vectorSize = vectorSize;
        /**
         * The actual data stored in this buffer.
         * @name VertexBuffer#_data
         * @type Float32Array
         */
        this._data = new Float32Array(numVectors * this._vectorSize);
        /**
         * The WebGL handle for this vertex buffer object.
         * @name VertexBuffer#_id
         * @type WebGLBuffer
         */
        this._id = null;
        /**
         * The location (index) of this vertex buffer, based on the index of the
         * attribute array it is bound to.
         * @name VertexBuffer#_location
         * @type Number
         */
        this._location = null;
    }

    /**
     * Getter for the _name property.
     * @returns {String}
     */
    VertexBuffer.prototype.getName = function () {
        return this._name;
    };

    /**
     * Getter for the _role property.
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
     * Enables the vertex attribute array belonging to this buffer in the supplied
     * GL context.
     * @param {ManagedGLContext} context
     */
    VertexBuffer.prototype.enable = function (context,shader) {
        var location = context.gl.getAttribLocation(shader.getIDForContext(context), this._name);
        if ((location !== -1) && (location !== this._location)) {
            this._location = location;
            context.gl.bindBuffer(context.gl.ARRAY_BUFFER, this._id);
            context.gl.enableVertexAttribArray(this._location);
            context.gl.vertexAttribPointer(this._location, this._vectorSize, context.gl.FLOAT, false, 0, 0);
        }
    };

    /**
     * Deletes the corresponding WebGL buffer object.
     * @param {ManagedGLContext} context
     */
    VertexBuffer.prototype.delete = function (context) {
        context.gl.deleteBuffer(this._id);
    };

    /**
     * If the passed shader has an attribute with the same name as this buffer,
     * binds the buffer to that attribute. If the buffer has already been bound
     * to the attribute from another shader that has a different index, shows a
     * notification instead as this will break the functionality. Attributes with 
     * the same names in different shaders need to have the same index to avoid
     * this. (a different vertex buffer is created for each differently named 
     * attribute)
     * @param {ManagedGLContext} context The WebGL context within which the binding
     * takes place.
     * @param {Shader} shader The shader that will be searched for an appropriate
     * attribute.
     */
    VertexBuffer.prototype.bindToAttribute = function (context, shader) {
        // set the shader program so we can grab the attribute addresses
        context.gl.useProgram(shader.getIDForContext(context));
        var location = context.gl.getAttribLocation(shader.getIDForContext(context), this._name);
        // we only need to bind the buffer if a corresponding attribute exists
        if (location !== -1) {
            //if (this._location === null) {
                this._location = location;
                context.gl.vertexAttribPointer(this._location, this._vectorSize, context.gl.FLOAT, false, 0, 0);
                context.gl.enableVertexAttribArray(this._location);
            //} else if (this._location !== location) {
            //    Application.showError("Attempting to bind vertex buffer (" + this._name + ") to 2 different locations!",
            //    undefined,"First attempt at location "+this._location+", second at location "+location+". The shader that caused the error: "+shader.getName()+".");
            //}
        }
    };

    function FrameBuffer(name, width, height) {
        /**
         * The name by which this buffer can be referred to.
         * @name FrameBuffer#_name
         * @type String
         */
        this._name = name;
        /**
         * The WebGL handle for this frame buffer object.
         * @name FrameBuffer#_id
         * @type WebGLBuffer
         */
        this._id = null;
        this._width = width;
        this._height = height;
        this._textureID = null;
        this._renderBufferID = null;
    }
    
    /**
     * Getter for the _name property.
     * @returns {String}
     */
    FrameBuffer.prototype.getName = function () {
        return this._name;
    };
    
    /**
     * Getter for the _textureID property.
     * @returns {String}
     */
    FrameBuffer.prototype.getTextureID = function () {
        return this._textureID;
    };

    FrameBuffer.prototype.setup = function (context) {
        this._id = context.gl.createFramebuffer();
        context.gl.bindFramebuffer(context.gl.FRAMEBUFFER, this._id);

        this._textureID = context.gl.createTexture();
        context.gl.bindTexture(context.gl.TEXTURE_2D, this._textureID);
        context.gl.texParameteri(context.gl.TEXTURE_2D, context.gl.TEXTURE_MAG_FILTER, context.gl.LINEAR);
        context.gl.texParameteri(context.gl.TEXTURE_2D, context.gl.TEXTURE_MIN_FILTER, context.gl.LINEAR);
        context.gl.texImage2D(context.gl.TEXTURE_2D, 0, context.gl.RGBA, this._width, this._height, 0, context.gl.RGBA, context.gl.UNSIGNED_BYTE, null);

        this._renderBufferID = context.gl.createRenderbuffer();
        context.gl.bindRenderbuffer(context.gl.RENDERBUFFER, this._renderBufferID);
        context.gl.renderbufferStorage(context.gl.RENDERBUFFER, context.gl.DEPTH_COMPONENT16, this._width, this._height);

        context.gl.framebufferTexture2D(context.gl.FRAMEBUFFER, context.gl.COLOR_ATTACHMENT0, context.gl.TEXTURE_2D, this._textureID, 0);
        context.gl.framebufferRenderbuffer(context.gl.FRAMEBUFFER, context.gl.DEPTH_ATTACHMENT, context.gl.RENDERBUFFER, this._renderBufferID);
    };

    FrameBuffer.prototype.bind = function (context) {
        context.gl.bindFramebuffer(context.gl.FRAMEBUFFER, this._id);
    };

    /**
     * Creates a new Shader object.
     * @class A wrapper class representing a WebGL shader program.
     * @param {string} name The name of the shader program it can be referred to 
     * with later.
     * @param {string} vertexShaderFileName The name of the file containing the 
     * vertex shader code.
     * @param {string} fragmentShaderFileName The name of the file containing the
     * fragment shader code.
     * @param {string} blendType What kind of blending function should be used
     * while rendering with this shader.
     * @param {ShaderAttribute[]} attributes The list of attributes this shader
     * has as an input.
     * @param {ShaderUniform[]} uniforms The list of uniform variables this shader
     * contains.
     * */
    function Shader(name, vertexShaderFileName, fragmentShaderFileName, blendType, attributes, uniforms) {
        Resource.call(this);
        // properties for file resource management
        /**
         * The name of the shader program it can be referred to with later. Has to
         * be unique.
         * @name Shader#_name
         * @type String
         */
        this._name = name;
        /**
         * The URL of the vertex shader source file, relative to the site root.
         * @name Shader#_vertexShaderFileName
         * @type String
         */
        this._vertexShaderFileName = vertexShaderFileName;
        /**
         * The URL of the fragment shader source file, relative to the site root.
         * @name Shader#_fragmentShaderFileName
         * @type String
         */
        this._fragmentShaderFileName = fragmentShaderFileName;
        /**
         * The type of blending to be used with this shader. Options:
         * "mix": will overwrite the existing color up to the proportion of the 
         * alpha component of the new color (srcAlpha + (1-srcAlpha)) 
         * "add": will add the color of the existing one (srcAlpha + 1)
         * @name Shader#_blendType
         * @type String
         */
        this._blendType = blendType;
        /**
         * The list of shader attribute properties of this shader.
         * @name Shader#_attributes
         * @type ShaderAttribute[]
         */
        this._attributes = attributes;
        /**
         * The list of shader uniforms of this shader.
         * @name Shader#_uniforms
         * @type ShaderUniform[]
         */
        this._uniforms = uniforms;
        /**
         * The source code of the vertex shader.
         * @name Shader#_vertexShaderSource
         * @type String
         */
        this._vertexShaderSource = null;
        /**
         * The source code of the fragment shader.
         * @name Shader#_fragmentShaderSource
         * @type String
         */
        this._fragmentShaderSource = null;
        // properties for WebGL resource management
        /**
         * The associative array of WebGL program IDs belonging to managed contexts 
         * which this program has been associated with. The keys are the names of the managed
         * contexts, and values are the WebGL IDs (handles)
         * @name Shader#_ids
         * @type Object
         */
        this._ids = new Object();
    }

// as it is an asynchronously loaded resource, we set the Resource as parent
// class to make handling easier
    Shader.prototype = new Resource();
    Shader.prototype.constructor = Shader;

    /**
     * Getter for the _name property.
     * @returns {String}
     */
    Shader.prototype.getName = function () {
        return this._name;
    };

    /**
     * Returns the WebGL ID of this program valid in the supplied managed context.
     * Error checking is not performed - if there is no valid ID for this context,
     * it will return undefined.
     * @param {ManagedGLContext} context
     * @returns {WebGLProgram}
     */
    Shader.prototype.getIDForContext = function (context) {
        return this._ids[context.getName()];
    };

    /**
     * Returns the array of shader attributes of this shader.
     * @returns {ShaderAttribute[]}
     */
    Shader.prototype.getAttributes = function () {
        return this._attributes;
    };

    /**
     * Initiates asynchronous requests to load the vertex and fragment shader source
     * codes from files. When the loading finishes, the shader {@link Resource} 
     * is marked ready to use and the potentially queued actions are executed.
     */
    Shader.prototype.requestLoadFromFile = function () {
        if (this.isReadyToUse() === false) {
            var self = this;
            Application.requestTextFile("shader", this._vertexShaderFileName, function (responseText) {
                self._vertexShaderSource = responseText;
                if (self._fragmentShaderSource !== null) {
                    self.setToReady();
                }
                // override the mime type to avoid error messages in Firefox developer
                // consol when it tries to parse as XML
            }, 'text/plain; charset=utf-8');
            Application.requestTextFile("shader", this._fragmentShaderFileName, function (responseText) {
                self._fragmentShaderSource = responseText;
                if (self._vertexShaderSource !== null) {
                    self.setToReady();
                }
                // override the mime type to avoid error messages in Firefox developer
                // consol when it tries to parse as XML    
            }, 'text/plain; charset=utf-8');
        }
    };

    /**
     * Adds the shader resource to be available for the provided managed WebGL
     * context. If it has already been added, does nothing. (as typically this
     * will be called many times, with different {@link VisualObject}s containing 
     * the shader request it to be added to the context where they are to be
     * drawn) The action is only executed when the shader has been loaded.
     * @param {ManagedGLContext} context
     */
    Shader.prototype.addToContext = function (context) {
        this.executeWhenReady(function () {
            if (this._ids[context.getName()] === undefined) {
                var gl = context.gl;
                // create and compile vertex shader
                var vertexShader = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vertexShader, this._vertexShaderSource);
                gl.compileShader(vertexShader);
                // detect and display compilation errors
                if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                    var infoLog = gl.getShaderInfoLog(vertexShader);
                    Application.showError("Compiling GLSL vertex shader '" + this._vertexShaderFileName + "' failed.", "severe", "More details:\n" + infoLog);
                    this._ids[context.getName()] = null;
                    return;
                }
                // create and compile fragment shader
                var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fragmentShader, this._fragmentShaderSource);
                gl.compileShader(fragmentShader);
                // detect and display compilation errors
                if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                    var infoLog = gl.getShaderInfoLog(fragmentShader);
                    Application.showError("Compiling GLSL fragment shader '" + this._fragmentShaderFileName + "' failed.", "severe", "More details:\n" + infoLog);
                    this._ids[context.getName()] = null;
                    return;
                }
                // create and link shader program
                this._ids[context.getName()] = gl.createProgram();
                var prog = this._ids[context.getName()];
                gl.attachShader(prog, vertexShader);
                gl.attachShader(prog, fragmentShader);
                gl.linkProgram(prog);
                // detect and display linking errors
                if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                    var infoLog = gl.getProgramInfoLog(prog);
                    Application.showError("Linking GLSL shader '" + this._name + "' failed.", "severe", "More details: " + infoLog);
                    gl.deleteProgram(prog);
                    this._ids[context.getName()] = null;
                    return;
                }
                // cache uniform locations
                for (var i = 0; i < this._uniforms.length; i++) {
                    this._uniforms[i].setLocation(context, this);
                }
                // add the created shader to the context's managed resources list
                context.addShader(this);
            }
        });
    };

    /**
     * Clears all previous bindings to managed WebGL contexts.
     */
    Shader.prototype.clearContextBindings = function () {
        this._ids = new Object();
    };

    /**
     * Sets the blending function in the supplied managed context according to the
     * blending type of this shader.
     * @param {ManagedGLContext} context
     */
    Shader.prototype.setBlending = function (context) {
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
    Shader.prototype.assignUniforms = function (context, uniformValueFunctions) {
        for (var i = 0; i < this._uniforms.length; i++) {
            if (uniformValueFunctions[this._uniforms[i].getName()] !== undefined) {
                this._uniforms[i].setValue(context, this, uniformValueFunctions[this._uniforms[i].getName()]);
            }
        }
    };

    /**
     * Enables the vertex buffers associated with the indices of the vertex 
     * attributes that this shader has.
     * @param {ManagedGLContext} context
     */
    Shader.prototype.enableVertexBuffers = function (context) {
        for (var i = 0; i < this._attributes.length; i++) {
            context.getVertexBuffer(this._attributes[i].name).enable(context,this);
        }
    };

    /**
     * Creates a managed WebGL context for the given HTML5 canvas element.
     * @class Adds higher level management functions to the WebGLRenderingContext
     * class. {@link Texture}, {@link Cubemap}, {@link Shader} and 
     * {@link EgomModel} resources can be linked to it, and can set up the vertex
     * buffers according to the linked model resources.
     * @param {String} name The name of the context.
     * @param {HTMLCanvasElement} canvas The canvas for which the context is to be
     * created.
     * @param {Boolean} antialiasing Whether antialising should be turned on for
     * this context. If the WebGL implementation does not support antialiasing, this
     * will have no effect.
     * @param {String} filtering What kind of texture filtering should be used for
     * 2D textures. Supported values are: bilinear, trilinear, anisotropic (which
     * will be 4:1)
     * @returns {ManagedGLContext}
     */
    function ManagedGLContext(name, canvas, antialiasing, filtering) {
        Resource.call(this);
        /**
         * The name of the context by which it can be referred to.
         * @name ManagedGLContext#_name
         * @type String
         */
        this._name = name;
        /**
         * The contained basic WebGL rendering context.
         * @name ManagedGLContext#gl
         * @type WebGLRenderingContext
         */
        this.gl = null;
        /**
         * Whether antialiasing is enabled for the WebGL context.
         * @name ManagedGLContext#_antialiasing
         * @type Boolean
         */
        this._antialiasing = antialiasing;
        /**
         * What filtering is used for 2D textures. Supported values are: bilinear,
         * trilinear and anisotropic. Attempting to create the context with anisotropic
         * filtering will cause it to probe if the functionality is available, and will
         * set 4:1 anisotropic filtering up if so, otherwise revert back to trilinear
         * filtering.
         * @name ManagedGLContext#_filtering
         * @type String
         */
        this._filtering = filtering;
        /**
         * Holder for the handle of the anisotropic filter WebGL extension, should it
         * be needed.
         * @name ManagedGLContext#_anisotropicFilter
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
         * @name ManagedGLContext#_shaders
         * @type Shader[]
         */
        this._shaders = new Array();
        /**
         * The list of associated models. This needs to be stored in order to fill 
         * the vertex buffer objects with data from these models when the buffers 
         * are created. <br/>
         * The model objects are created and managed using a {@link ResourceManager}, 
         * and this context only references them.
         * @name ManagedGLContext#_models
         * @type Model[]
         */
        this._models = new Array();
        /**
         * The associative array of vertex buffer objects, stored by their names 
         * (which equal the names of their corresponding attributes) as the keys.
         * @name ManagedGLContext#_vertexBuffers
         * @type Object
         */
        this._vertexBuffers = null;
        this._frameBuffers = new Object();
        /**
         * A reference to the currently used shader in order to quickly dismiss 
         * calls that aim to set the same again.
         * @name ManagedGLContext#_currentShader
         * @type Shader
         */
        this._currentShader = null;
        /**
         * The list of references to the currently bound textures in order to 
         * quickly dismiss calls that aim to bind the same texture to the same place
         * again. The indices mark which activeTexture place the texture is bound 
         * to.
         * @name ManagedGLContext#_boundTextures
         * @type Texture[]
         */
        this._boundTextures = new Array();

        // creating the contained WebGLRenderingContext
        try {
            var contextParameters = {alpha: true, antialias: antialiasing};
            // Try to grab the standard context. If it fails, fallback to experimental.
            this.gl = canvas.getContext("webgl", contextParameters) ||
                    canvas.getContext("experimental-webgl", contextParameters);
        }
        catch (e) {
        }

        if (!this.gl) {
            Application.showError("Unable to initialize WebGL.", "critical",
                    "It looks like your device, browser or graphics drivers do not " +
                    "support web 3D graphics. Make sure your browser and graphics " +
                    "drivers are updated to the latest version, and you are using " +
                    "a modern web browser (Firefox or Chrome are recommended).\n" +
                    "Please note that some phones or handheld devices do not have 3D " +
                    "web capabilities, even if you use the latest software.");
        }

        // is filtering is set to anisotropic, try to grap the needed extension. If that fails,
        // fall back to trilinear filtering.
        if (this._filtering === "anisotropic") {
            this._anisotropicFilter = this.gl.getExtension("EXT_texture_filter_anisotropic");
            if (this._anisotropicFilter === null) {
                this._filtering = "trilinear";
            }
        }

        // some basic settings on the context state machine
        this.gl.clearDepth(1.0);
        this.gl.colorMask(true, true, true, true);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.enable(this.gl.BLEND);
        this.gl.enable(this.gl.SCISSOR_TEST);
        this.gl.activeTexture(this.gl.TEXTURE0);
    }

    ManagedGLContext.prototype = new Resource();
    ManagedGLContext.prototype.constructor = ManagedGLContext;

    /**
     * Getter for the _name property.
     * @returns {String}
     */
    ManagedGLContext.prototype.getName = function () {
        return this._name;
    };

    /**
     * Getter for the _filtering property.
     * @returns {String}
     */
    ManagedGLContext.prototype.getFiltering = function () {
        return this._filtering;
    };

    /**
     * Getter for the _anisotropicFilter property.
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
     * @param {Shader} shader
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
     * Passes the data to the stored vertex buffer objects.
     * @param {Object} data The data to store in the vertex buffers. It has to be
     * an associative array storing the Float32Arrays of the data organized by the
     * role (String) of the vertex buffer they are to be stored in as the key.
     * @param {Number} startIndex The starting index in the buffers from where to
     * set the data.
     */
    ManagedGLContext.prototype.setVertexBufferData = function (data, startIndex) {
        for (var vbName in this._vertexBuffers) {
            if (data[this._vertexBuffers[vbName].getRole()] !== undefined) {
                this._vertexBuffers[vbName].setData(data[this._vertexBuffers[vbName].getRole()], startIndex);
            }
        }
    };

    /**
     * Based on the stored shader references, creates a vertex buffer object to each 
     * attribute with a unique name, fills them with data using the stored model
     * references and then binds the vertex buffer objects to the corresponding
     * attribute indices. After this method, the context is ready to render any
     * resources that have been added to it up to this point.
     */
    ManagedGLContext.prototype.setupVertexBuffers = function () {
        if (this.isReadyToUse() === true) {
            return;
        }
        var i, j;
        var vbName;

        // delete possibly previously created buffers
        for (vbName in this._vertexBuffers) {
            this._vertexBuffers[vbName].delete(this);
        }

        // counting the number of vertices we need to put into the vertex buffers
        var sumVertices = 0;
        for (i = 0; i < this._models.length; i++) {
            sumVertices = sumVertices + this._models[i].getBufferSize(this);
        }

        // creating a Float32Array of the appropriate size for each needed buffer
        this._vertexBuffers = new Object();
        for (i = 0; i < this._shaders.length; i++) {
            var shaderAttributes = this._shaders[i].getAttributes();
            for (j = 0; j < shaderAttributes.length; j++) {
                this.addVertexBuffer(new VertexBuffer(shaderAttributes[j].name, shaderAttributes[j].role, shaderAttributes[j].size, sumVertices));
            }
        }

        // filling the buffer data arrays from model data
        var bufferSize = 0;
        for (i = 0; i < this._models.length; i++) {
            bufferSize += this._models[i].loadToVertexBuffers(this, bufferSize);
        }

        // load the data to GPU memory and bind the attributes of the shaders with 
        // the corresponding VBOs
        for (vbName in this._vertexBuffers) {
            this._vertexBuffers[vbName].loadToGPUMemory(this);
            for (i = 0; i < this._shaders.length; i++) {
                this._vertexBuffers[vbName].bindToAttribute(this, this._shaders[i]);
            }
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
        }
    };

    ManagedGLContext.prototype.setupFrameBuffers = function () {
        for (var fbName in this._frameBuffers) {
            this._frameBuffers[fbName].setup(this);
        }
        this.setToReady();
    };

    ManagedGLContext.prototype.setCurrentFrameBuffer = function (name) {
        this._frameBuffers[name].bind(this);
    };

    /**
     * Getter for the _currentShader property.
     * @returns {Shader}
     */
    ManagedGLContext.prototype.getCurrentShader = function () {
        return this._currentShader;
    };

    /**
     * Sets up the provided shader for usage within the provided scene, also 
     * assigning the scene uniforms.
     * @param {Shader} shader The shader to set as current.
     * @param {Scene} scene The scene to get the uniform values from.
     */
    ManagedGLContext.prototype.setCurrentShader = function (shader, scene) {
        if (this._currentShader !== shader) {
            this.gl.useProgram(shader.getIDForContext(this));
            shader.setBlending(this);
            shader.enableVertexBuffers(this);
            scene.assignUniforms(this, shader);
            this._currentShader = shader;
        }
    };

    /**
     * Binds the given {@link Texture} or {@link Cubemap} resource to the given
     * texture place.
     * @param {Texture|Cubemap} texture The resource to bind for rendering.
     * @param {Number} place To which activeTexture place does it need to bind (for 
     * multi-texturing, starting with 0) So far set to support 4 textures max at a
     * time.
     */
    ManagedGLContext.prototype.bindTexture = function (texture, place) {
        switch (place) {
            case 0:
                this.gl.activeTexture(this.gl.TEXTURE0);
                break;
            case 1:
                this.gl.activeTexture(this.gl.TEXTURE1);
                break;
            case 2:
                this.gl.activeTexture(this.gl.TEXTURE2);
                break;
            case 3:
                this.gl.activeTexture(this.gl.TEXTURE3);
                break;
            default:
                this.gl.activeTexture(this.gl["TEXTURE" + place]);
        }
        if (this._boundTextures[place] !== texture) {
            if (texture instanceof Texture) {
                this.gl.bindTexture(this.gl.TEXTURE_2D, texture.getIDForContext(this));
            } else
            if (texture instanceof Cubemap) {
                this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, texture.getIDForContext(this));
            } else
            if (texture instanceof FrameBuffer) {
                this.gl.bindTexture(this.gl.TEXTURE_2D, texture.getTextureID());
            }
            this._boundTextures[place] = texture;
        }
    };

    /**
     * Creates a new Resource Manager object.
     * @class This class holds and manages all the various resources and their 
     * configuration that are needed for rendering: textures, shaders, models.
     */
    function ResourceManager() {
        Resource.call(this);
        /**
         * The associative array of cube mapped textures. The keys are the names of 
         * the textures. The values are instances of {@link CubemappedTexture}.
         * @name ResourceManager#_cubemappedTextures
         * @type Object
         */
        this._cubemappedTextures = null;
        /**
         * Associative array holding references to those cubemap textures which have
         * been requested to be loaded. All cubemaps are added to _cubemappedTextures
         * in the beginning of the game, when the XML file describing the shaders
         * (and cubemapped textures) is loaded, but not all need to be loaded from 
         * file for every scene. When a cubemap from _cubemappedTextures is requested 
         * for an upcoming scene (with getCubemappedTexture()), it is added to this
         * property to mark it for loading. The arrangement of the Object is the same 
         * as {@link ResourceManager#_cubemappedTextures}.
         * @name ResourceManager#_requestedCubemappedTextures
         * @type Object
         */
        this._requestedCubemappedTextures = null;
        /**
         * Number of stored cubemapped textures requested for loading.
         * @name ResourceManager#_numRequestedCubemappedTextures
         * @type Number
         */
        this._numRequestedCubemappedTextures = null;
        /**
         * Number of stored cubemapped textures that already have been loaded (from
         * files) and are ready to use.
         * @name ResourceManager#_numCubemappedTexturesLoaded
         * @type Number
         */
        this._numCubemappedTexturesLoaded = null;
        /**
         * The function to be executed when all cubemaps have been loaded.
         * @name ResourceManager#onAllCubemappedTexturesLoad
         * @type Function
         */
        this.onAllCubemappedTexturesLoad = function () {
        };
        /**
         * The associative array of shader programs. The keys are the names of the 
         * program. The values are instances of {@link Shader}.
         * @name ResourceManager#_shaders
         * @type Object
         */
        this._shaders = null;
        /**
         * Associative array holding references to those shader programs which have
         * been requested to be loaded. All shader programs are added to _shaders
         * in the beginning of the game, when the XML file describing the shaders
         * is loaded, but not all need to be loaded from file for every scene. When
         * a shader from _shaders is requested for an upcoming scene (with 
         * getShader()), it is added to this property to mark it for loading. The
         * arrangement of the Object is the same as {@link ResourceManager#_shaders}.
         * @name ResourceManager#_requestedShaders
         * @type Object
         */
        this._requestedShaders = null;
        /**
         * Number of shaders requested for loading.
         * @name ResourceManager#_numShaders
         * @type Number
         */
        this._numRequestedShaders = null;
        /**
         * Number of stored shaders that already have been loaded (from files) and 
         * are ready to use.
         * @name ResourceManager#_numShadersLoaded
         * @type Number
         */
        this._numShadersLoaded = null;
        /**
         * The function to be executed when all shaders have been loaded.
         * @name ResourceManager#onAllShadersLoad
         * @type Function
         */
        this.onAllShadersLoad = function () {
        };
        /**
         * The associative array of 2D textures. The keys are the filenames of the 
         * texture. The values are instances of {@link Texture}.
         * @name ResourceManager#_textures
         * @type Object
         */
        this._textures = new Object();
        /**
         * Number of stored 2D textures.
         * @name ResourceManager#_numTextures
         * @type Number
         */
        this._numTextures = 0;
        /**
         * Number of stored 2D textures that already have been loaded (from files) and 
         * are ready to use.
         * @name ResourceManager#_numTexturesLoaded
         * @type Number
         */
        this._numTexturesLoaded = 0;
        /**
         * The function to be executed when all 2D textures have been loaded.
         * @name ResourceManager#onAllTexturesLoad
         * @type Function
         */
        this.onAllTexturesLoad = function () {
        };
        /**
         * The associative array of 3D geometry models. The keys are the names of 
         * the model. The values are instances of {@link EgomModel}.
         * @name ResourceManager#_models
         * @type Object
         */
        this._models = new Object();
        /**
         * Number of stored models.
         * @name ResourceManager#_numModels
         * @type Number
         */
        this._numModels = 0;
        /**
         * Number of stored models that already have been loaded (from files) and 
         * are ready to use.
         * @name ResourceManager#_numModelsLoaded
         * @type Number
         */
        this._numModelsLoaded = 0;
        /**
         * The function to be executed when all models have been loaded.
         * @name ResourceManager#onAllModelsLoad
         * @type Function
         */
        this.onAllModelsLoad = function () {
        };
        /**
         * The function to be executed every time when a resource is loaded. The
         * following arguments will be passed to it: the name of the loaded 
         * resource, the number of total resources and the number of resources
         * already loaded.
         * @name ResourceManager#onResourceLoad
         * @type Function
         */
        this.onResourceLoad = function () {
        };
    }

// we set the Resource class as parent to add an execution queue to the resource
// manage for when all resources have been loaded
    ResourceManager.prototype = new Resource();
    ResourceManager.prototype.constructor = ResourceManager;

    /**
     * Tells if all added cubemapped textures have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allCubemappedTexturesLoaded = function () {
        return (this._numRequestedCubemappedTextures === this._numCubemappedTexturesLoaded);
    };

    /**
     * Tells if all requested shaders have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allShadersLoaded = function () {
        return (this._numRequestedShaders === this._numShadersLoaded);
    };

    /**
     * Tells if all added 2D textures have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allTexturesLoaded = function () {
        return (this._numTextures === this._numTexturesLoaded);
    };

    /**
     * Tells if all added models have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allModelsLoaded = function () {
        return (this._numModels === this._numModelsLoaded);
    };

    /**
     * Tells if all added resources have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allResourcesLoaded = function () {
        return (
                this.allCubemappedTexturesLoaded() &&
                this.allShadersLoaded() &&
                this.allTexturesLoaded() &&
                this.allModelsLoaded()
                );
    };

    /**
     * Returns the total number of resources requested for loading.
     * @returns {Number}
     */
    ResourceManager.prototype.getNumberOfResources = function () {
        return this._numRequestedCubemappedTextures + this._numRequestedShaders + this._numTextures + this._numModels;
    };

    /**
     * Returns the number of resources stored by the manager that already have been
     * loaded and are ready to use.
     * @returns {Number}
     */
    ResourceManager.prototype.getNumberOfLoadedResources = function () {
        return this._numCubemappedTexturesLoaded + this._numShadersLoaded + this._numTexturesLoaded + this._numModelsLoaded;
    };

    /**
     * If a texture with the given filename is stored by the manager, returns a
     * reference to it, otherwise adds a new texture with this filename.
     * @param {String} filename
     * @param {Boolean} [useMipmap=true]
     * @returns {Texture}
     */
    ResourceManager.prototype.getOrAddTexture = function (filename, useMipmap) {
        var textureName = filename;
        if (useMipmap === false) {
            textureName += "_noMipmap";
        }
        if (this._textures[textureName] === undefined) {
            this._numTextures += 1;
            this.resetReadyState();
            this._textures[textureName] = new Texture(filename, useMipmap);
            var self = this;
            this._textures[textureName].executeWhenReady(function () {
                self._numTexturesLoaded += 1;
                self.onResourceLoad(filename, self.getNumberOfResources(), self.getNumberOfLoadedResources());
                if (self.allTexturesLoaded()) {
                    self.onAllTexturesLoad();
                }
                if (self.allResourcesLoaded()) {
                    self.setToReady();
                }
            });
        }
        return this._textures[textureName];
    };

    /**
     * Performs a getOrAddTexture() using the properties of the texture descriptor.
     * @param {TextureDescriptor} descriptor
     */
    ResourceManager.prototype.getOrAddTextureFromDescriptor = function (descriptor) {
        return this.getOrAddTexture(descriptor.filename, descriptor.useMipmap);
    };

    /**
     * Adds the passed cubemapped texture to the stored resources.
     * @param {Cubemap} cubemappedTexture
     */
    ResourceManager.prototype.addCubemappedTexture = function (cubemappedTexture) {
        this._cubemappedTextures[cubemappedTexture.getName()] = cubemappedTexture;
    };

    /**
     * Returns the stored cubemapped texture that has the given name, if such 
     * exists.
     * @param {String} name
     * @returns {Cubemap}
     */
    ResourceManager.prototype.getCubemappedTexture = function (name) {
        if (this._cubemappedTextures[name] === undefined) {
            Application.showError("Asked for a cube mapped texture named '" + name + "', which does not exist.");
            return null;
        } else {
            if (this._requestedCubemappedTextures[name] === undefined) {
                this._numRequestedCubemappedTextures += 1;
                this.resetReadyState();
                this._requestedCubemappedTextures[name] = this._cubemappedTextures[name];
                var self = this;
                this._requestedCubemappedTextures[name].executeWhenReady(function () {
                    self._numCubemappedTexturesLoaded += 1;
                    self.onResourceLoad(name, self.getNumberOfResources(), self.getNumberOfLoadedResources());
                    if (self.allCubemappedTexturesLoaded()) {
                        self.onAllCubemappedTexturesLoad();
                    }
                    if (self.allResourcesLoaded()) {
                        self.setToReady();
                    }
                });
            }
            return this._cubemappedTextures[name];
        }
    };

    /**
     * Adds the passed shader to the stored resources.
     * @param {Shader} shader
     */
    ResourceManager.prototype.addShader = function (shader) {
        this._shaders[shader.getName()] = shader;
    };

    /**
     * Returns the stored shader that has the given name, if such exists.
     * @param {String} name
     * @returns {Shader}
     */
    ResourceManager.prototype.getShader = function (name) {
        if (this._shaders[name] === undefined) {
            Application.showError("Asked for a shader named '" + name + "', which does not exist.");
            return null;
        } else {
            if (this._requestedShaders[name] === undefined) {
                this._numRequestedShaders += 1;
                this.resetReadyState();
                this._requestedShaders[name] = this._shaders[name];
                var self = this;
                this._requestedShaders[name].executeWhenReady(function () {
                    self._numShadersLoaded += 1;
                    self.onResourceLoad(name, self.getNumberOfResources(), self.getNumberOfLoadedResources());
                    if (self.allShadersLoaded()) {
                        self.onAllShadersLoad();
                    }
                    if (self.allResourcesLoaded()) {
                        self.setToReady();
                    }
                });
            }
            return this._requestedShaders[name];
        }
    };

    /**
     * Looks for a model with the given filename in the resource manager, if not
     * present yet, adds it, then returns it.
     * @param {String} filename The name of the file of the model resource we are looking for.
     * @returns {EgomModel} The found or added model object in the resource manager.
     */
    ResourceManager.prototype.getOrAddModelFromFile = function (filename) {
        if (this._models[filename] === undefined) {
            this._numModels += 1;
            this.resetReadyState();
            this._models[filename] = new Egom.Model(filename);
            var self = this;
            this._models[filename].executeWhenReady(function () {
                self._numModelsLoaded += 1;
                self.onResourceLoad(filename, self.getNumberOfResources(), self.getNumberOfLoadedResources());
                if (self.allModelsLoaded()) {
                    self.onAllModelsLoad();
                }
                if (self.allResourcesLoaded()) {
                    self.setToReady();
                }
            });
        }
        return this._models[filename];
    };

    /**
     * Gets the model stored in the resource manager, searching for it by its name, 
     * or if it does not exist yet, adds it.
     * @param {Egom.Model} model The model resource we are looking for in the 
     * resource manager.
     * @returns {Egom.Model} The found or added model object in the resource manager.
     */
    ResourceManager.prototype.getOrAddModelByName = function (model) {
        if (!model.getName()) {
            Application.showError("Trying to search for a model among the resources which does not have a name!");
            return null;
        }
        if (!this._models[model.getName()]) {
            this._models[model.getName()] = model;
        }
        return this._models[model.getName()];
    };

    /**
     * Initiates the requests to load all the stored 2D texture resources from their 
     * associated files.
     */
    ResourceManager.prototype.requestTextureLoadFromFile = function () {
        for (var texture in this._textures) {
            this._textures[texture].requestLoadFromFile();
        }
    };

    /**
     * Initiates the requests to load all the stored cubemapped texture resources 
     * from their associated files.
     */
    ResourceManager.prototype.requestCubemappedTextureLoadFromFile = function () {
        for (var texture in this._requestedCubemappedTextures) {
            this._requestedCubemappedTextures[texture].requestLoadFromFile();
        }
    };

    /**
     * Initiates the requests to load all the shader resources that have been
     * requested for loading from their associated files.
     */
    ResourceManager.prototype.requestShaderLoadFromFile = function () {
        for (var shader in this._requestedShaders) {
            this._requestedShaders[shader].requestLoadFromFile();
        }
    };

    /**
     * Initiates the requests to load all the stored model resources from their 
     * associated files.
     */
    ResourceManager.prototype.requestModelLoadFromFile = function () {
        for (var model in this._models) {
            this._models[model].requestLoadFromFile();
        }
    };

    /**
     * Initiates the request to load the shader and cubemap configuration (what are
     * the available cubemaps and shaders and their source files) from the XML file
     * of the passed name.
     * @param {String} filename The name of the XML file where the configuration
     * is stored (relative to the config file folder)
     */
    ResourceManager.prototype.requestShaderAndCubemapObjectLoad = function (filename) {
        var self = this;
        Application.requestXMLFile("config", filename, function (responseXML) {
            self.loadShaderAndCubemapObjectsFromXML(responseXML);
        });
    };

    /**
     * Loads the cubemap and shader configuration (not the resources, just their
     * meta-data) from the passed XML document.
     * @param {XMLDocument} xmlSource
     */
    ResourceManager.prototype.loadShaderAndCubemapObjectsFromXML = function (xmlSource) {
        var i, j, k;
        var index;

        this._numRequestedCubemappedTextures = 0;
        this._numCubemappedTexturesLoaded = 0;
        this._cubemappedTextures = new Object();
        this._requestedCubemappedTextures = new Object();
        var cubemapTags = xmlSource.getElementsByTagName("Cubemap");
        for (i = 0; i < cubemapTags.length; i++) {
            var imageTags = cubemapTags[i].getElementsByTagName("image");
            var imageURLs = new Array(6);
            for (j = 0; j < imageTags.length; j++) {
                index = -1;
                switch (imageTags[j].getAttribute("direction")) {
                    case "pos_x":
                        index = 0;
                        break;
                    case "neg_x":
                        index = 1;
                        break;
                    case "pos_y":
                        index = 2;
                        break;
                    case "neg_y":
                        index = 3;
                        break;
                    case "pos_z":
                        index = 4;
                        break;
                    case "neg_z":
                        index = 5;
                        break;
                }
                imageURLs[index] = imageTags[j].getAttribute("url");
            }
            this.addCubemappedTexture(new Cubemap(cubemapTags[i].getAttribute("name"), imageURLs));
        }

        this._numRequestedShaders = 0;
        this._numShadersLoaded = 0;
        this._shaders = new Object();
        this._requestedShaders = new Object();
        var shaderTags = xmlSource.getElementsByTagName("Shader");
        for (i = 0; i < shaderTags.length; i++) {
            var attributes = new Array();
            var attributeTags = shaderTags[i].getElementsByTagName("attribute");
            for (j = 0; j < attributeTags.length; j++) {
                attributes.push(new ShaderAttribute(
                        attributeTags[j].getAttribute("name"),
                        parseInt(attributeTags[j].getAttribute("size")),
                        attributeTags[j].getAttribute("role"))
                        );
            }
            var uniforms = new Array();
            var uniformTags = shaderTags[i].getElementsByTagName("uniform");
            for (j = 0; j < uniformTags.length; j++) {
                uniforms.push(new ShaderUniform(
                        uniformTags[j].getAttribute("name"),
                        uniformTags[j].getAttribute("type"),
                        uniformTags[j].hasAttribute("arraySize") ? uniformTags[j].getAttribute("arraySize") : 0)
                        );
                if (uniformTags[j].hasAttribute("memberOf")) {
                    var parent = uniformTags[j].getAttribute("memberOf");
                    for (k = 0; k < uniforms.length; k++) {
                        if (uniforms[k].getName() === parent) {
                            uniforms[k].addMember(uniforms[uniforms.length - 1]);
                        }
                    }
                }
            }
            this.addShader(new Shader(
                    shaderTags[i].getAttribute("name"),
                    shaderTags[i].getElementsByTagName("vertex")[0].getAttribute("filename"),
                    shaderTags[i].getElementsByTagName("fragment")[0].getAttribute("filename"),
                    shaderTags[i].getElementsByTagName("blendType")[0].getAttribute("value"),
                    attributes,
                    uniforms
                    ));
        }
    };

    /**
     * Initiates all requests needed to load all the stored resources from their 
     * associated files. If there are no resources needed to load, just executes
     * the action queue set for when all resources get loaded.
     */
    ResourceManager.prototype.requestResourceLoad = function () {
        if (this.allResourcesLoaded() === true) {
            this.executeOnReadyQueue();
        } else {
            this.requestTextureLoadFromFile();
            this.requestCubemappedTextureLoadFromFile();
            this.requestShaderLoadFromFile();
            this.requestModelLoadFromFile();
        }
    };

    /**
     * Resets the binding of all stored resource to any managed GL context. (after
     * the contexts have been destroyed, new context might have the same ID, thus
     * the resources will think they are already set up while they are not)
     */
    ResourceManager.prototype.clearResourceContextBindings = function () {
        for (var texture in this._textures) {
            this._textures[texture].clearContextBindings();
        }
        for (var cubemap in this._cubemappedTextures) {
            this._cubemappedTextures[cubemap].clearContextBindings();
        }
        for (var shader in this._shaders) {
            this._shaders[shader].clearContextBindings();
        }
        for (var model in this._models) {
            this._models[model].clearContextBindings();
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        FrameBuffer: FrameBuffer,
        ManagedGLContext: ManagedGLContext,
        ResourceManager: ResourceManager
    };
});