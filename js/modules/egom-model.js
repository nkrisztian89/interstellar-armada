/**
 * Copyright 2014-2018 Krisztián Nagy
 * @file 
 * Provides a class representing a 3D model with several meshes storing the geometry of the model at different levels of detail. The model
 * can be edited directly, loaded from an EgomModel (egm) file, can provide its vertex data in a format suitable to be loaded to WebGL
 * vertex buffers as well as load it itself to vertex buffers and render it. Functions for generating and returning several simple models
 * are also included.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, Float32Array, parseFloat, Document */

/**
 * @param vec Used for vector operations to create / manipulate normal vectors.
 * @param application Used for displaying errors and logging.
 */
define([
    "utils/vectors",
    "modules/application"
], function (vec, application) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            VertexAttributeRole = {
                POSITION: "position",
                TEXTURE_COORDINATES: "texCoord",
                NORMAL: "normal",
                COLOR: "color",
                GROUP_INDICES: "groupIndices",
                TRIANGLE_INDEX: "triangleIndex"
            },
            // ------------------------------------------------------------------------------
            // constants
            DEFAULT_SQUARE_TEX_COORDINATES = [[0, 0], [1, 1]],
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * @typedef {Object} ModelDebugStats
             * @property {Number} triangleDrawCalls The number of non-instanced draw calls using triangle rendering.
             * @property {Number} triangles The number of triangles rendered via non-instanced draw calls.
             * @property {Number} lineDrawCalls The number of non-instanced draw calls using line rendering.
             * @property {Number} lines The number of lines rendered via non-instanced draw calls.
             * @property {Number} instancedTriangleDrawCalls The number of instanced draw calls using triangle rendering.
             * @property {Number} instancedTriangles The number of triangles rendered via instanced draw calls.
             * @property {Number} instancedLineDrawCalls The number of instanced draw calls using line rendering.
             * @property {Number} instancedLines The number of lines rendered via instanced draw calls.
             */
            // debug
            /**
             * An object to collect statistics about rendering for debug mode
             * @type ModelDebugStats
             */
            _DEBUG_STATS = {
                triangleDrawCalls: 0,
                triangles: 0,
                lineDrawCalls: 0,
                lines: 0,
                instancedTriangleDrawCalls: 0,
                instancedTriangles: 0,
                instancedLineDrawCalls: 0,
                instancedLines: 0
            },
            // general
            /**
             * The list of EgomModel versions that can be loaded from file.
             * @type String[]
             */
            _supportedVersions = ["3.2"];
    // freezing enum objects
    Object.freeze(VertexAttributeRole);
    // -------------------------------------------------------------------------
    // Public functions
    /**
     * Resets the counters for rendering statistics.
     */
    function resetDebugStats() {
        _DEBUG_STATS.triangleDrawCalls = 0;
        _DEBUG_STATS.triangles = 0;
        _DEBUG_STATS.lineDrawCalls = 0;
        _DEBUG_STATS.lines = 0;
        _DEBUG_STATS.instancedTriangleDrawCalls = 0;
        _DEBUG_STATS.instancedTriangles = 0;
        _DEBUG_STATS.instancedLineDrawCalls = 0;
        _DEBUG_STATS.instancedLines = 0;
    }
    /**
     * Returns the rendering statistics collected since the last reset.
     * @returns {ModelDebugStats}
     */
    function getDebugStats() {
        return _DEBUG_STATS;
    }
    // ############################################################################################
    /**
     * @class Represents a vertex in 3D space.
     * @param {Number} x 
     * @param {Number} y 
     * @param {Number} z 
     * @param {Number[2]} texCoords Texture coordinates.
     */
    function Vertex(x, y, z, texCoords) {
        /**
         * The X coordinate of the vertex.
         * @type Number
         */
        this.x = x;
        /**
         * The Y coordinate of the vertex.
         * @type Number
         */
        this.y = y;
        /**
         * The Z coordinate of the vertex.
         * @type Number
         */
        this.z = z;
        // if no texture coordinates were given, default to (x;y)
        texCoords = texCoords || [this.x, this.y];
        /**
         * The U (horizontal) texture coordinate of the vertex.
         * @type Number
         */
        this.u = texCoords[0];
        /**
         * The V (vertical) texture coordinate of the vertex.
         * @type Number
         */
        this.v = texCoords[1];
    }
    /**
     * Returns the texture coordinates associated with this vertex.
     * @returns {Number[2]}
     */
    Vertex.prototype.getTexCoords = function () {
        return [this.u, this.v];
    };
    /**
     * Sets the X coordinate of the vertex.
     * @param {Number} x
     */
    Vertex.prototype.setX = function (x) {
        this.x = x;
    };
    /**
     * Sets the Y coordinate of the vertex.
     * @param {Number} y
     */
    Vertex.prototype.setY = function (y) {
        this.y = y;
    };
    /**
     * Sets the Z coordinate of the vertex.
     * @param {Number} z
     */
    Vertex.prototype.setZ = function (z) {
        this.z = z;
    };
    // ############################################################################################
    /**
     * @class Represents a line connecting two vertices in a model.
     * @param {Number} a The index of the starting vertex of the line.
     * @param {Number} b The index of the end vertex of the line.
     * @param {Number[3]} color The color of the line. ([red, green, blue])
     * @param {Number[3]} normal The normal vector associated with the line.
     */
    function Line(a, b, color, normal) {
        /**
         * The index (in the model) of the starting vertex of the line.
         * @type Number
         */
        this.a = a;
        /**
         * The index (in the model) of the end vertex of the line.
         * @type Number
         */
        this.b = b;
        /**
         * The color of the line for rendering. ([red, green, blue])
         * @type Number
         */
        this.color = color;
        /**
         * The normal vector associated with the line for shading.
         * @type Number[3]
         */
        this.normal = normal;
    }
    // ############################################################################################
    /**
     * @class Represents a triangular face between 3 vertices of a model.
     * @param {Mesh} model The model to which this triangle is added.
     * @param {Number} a The index of the first vertex.
     * @param {Number} b The index of the second vertex.
     * @param {Number} c The index of the third vertex.
     * @param {Number[4]} color The color of the triangle. ([red, green, blue, alpha])
     * @param {Number[3][2]} texCoords The texture coordinates of the triangle's 
     * vertices. Format: [[a.u,a.v],[b.u,b.v],[c.u,c.v]]
     * @param {Number[][3]} [normals] The normal vectors of the triangle's vertices.
     * If the three vertives are the same, it is enough to pass an array with only
     * one element.
     * @param {Number} [groupIndices] The indices of the groups this triangle belongs to.
     */
    function Triangle(model, a, b, c, color, texCoords, normals, groupIndices) {
        /**
         * The model to which this triangle is added.
         * @type Mesh
         */
        this._mesh = model;
        /**
         * The index (in the model) of the first vertex of the triangle.
         * @type Number
         */
        this.a = a;
        /**
         * The index (in the model) of the second vertex of the triangle.
         * @type Number
         */
        this.b = b;
        /**
         * The index (in the model) of the third vertex of the triangle.
         * @type Number
         */
        this.c = c;
        /**
         * The RGBA color of the triangle. ([red, green, blue, alpha])
         * @type Number[4]
         */
        this.color = color;
        /**
         * The texture coordinates of the triangle's vertices. Format: 
         * [[a.u,a.v],[b.u,b.v],[c.u,c.v]]
         * @type Number[3][2]
         */
        this.texCoords = texCoords;
        /**
         * The normal vector(s) of the triangle's vertices. May have one (uniform
         * normal across the triangle) or three (different normal per vertex)
         * elements.
         * @type Number[][3]
         */
        this.normals = normals || vec.normalize3(vec.cross3(this._mesh.getVector(a, b), this._mesh.getVector(a, c)));
        /**
         * The indices of the groups (of various types) this triangle belongs to. Currently two groups types are used: the first index
         * indicates the transform group and the second one the luminosity group.
         * @type Number[2]
         */
        this.groupIndices = groupIndices || [0, 0];
    }
    /**
     * Returns the normal vector belonging to one of the vertices of this triangle.
     * @param {Number} index The index of the vertex (within the triangle: 0,1 or 2)
     * @returns {Number[3]}
     */
    Triangle.prototype.getNormal = function (index) {
        return (this.normals[index] || this.normals[0]);
    };
    // ############################################################################################
    /**
     * @class Stores the attributes that a mesh has associated with a managed
     * WebGL context.
     */
    function MeshContextProperties() {
        /**
         * The index marking where the data belonging to the lines of this 
         * model starts in the vertex buffer objects.
         * @type Number
         */
        this.bufferStartWireframe = 0;
        /**
         * The index marking where the data belonging to the triangles of this 
         * model starts in the vertex buffer objects.
         * @type Number
         */
        this.bufferStartSolid = 0;
        /**
         * The index marking where the data belonging to the transparent 
         * triangles of this model starts in the vertex buffer objects.
         * @type Number
         */
        this.bufferStartTransparent = 0;
    }
    // ############################################################################################
    /**
     * @class A single, specific mesh consisting of lines (for wireframe rendering) and 
     * triangles (for solid rendering) that connect 3D vertices. Multiple such
     * meshes that represent the same 3D model on different levels of detail
     * are grouped together in the Model class.
     */
    function Mesh() {
        /**
         * The array of vertices of the model. These can be referenced by index
         * when defining lines or triangles.
         * @type Vertex[]
         */
        this._vertices = [];
        /**
         * The array of lines of the model for wireframe rendering.
         * @type Line[]
         */
        this._lines = [];
        /**
         * The array of triangles of the model for solid rendering.
         * @type Triangle[]
         */
        this._triangles = [];
        /**
         * The size of the model. It is the double of the (absolute) largest coordinate
         * found among the vertices.
         * @type Number
         */
        this._size = 0;
        /**
         * The largest positive X coordinate found among the vertices.
         * @type Number
         */
        this._maxX = 0;
        /**
         * The largest negative X coordinate found among the vertices.
         * @type Number
         */
        this._minX = 0;
        /**
         * The largest positive Y coordinate found among the vertices.
         * @type Number
         */
        this._maxY = 0;
        /**
         * The largest negative Y coordinate found among the vertices.
         * @type Number
         */
        this._minY = 0;
        /**
         * The largest positive Z coordinate found among the vertices.
         * @type Number
         */
        this._maxZ = 0;
        /**
         * The largest negative Z coordinate found among the vertices.
         * @type Number
         */
        this._minZ = 0;
        /**
         * The number of opaque triangles this model contains.
         * @type Number
         */
        this._nOpaqueTriangles = 0;
        /**
         * The number of transparent triangles this model contains.
         * @type Number
         */
        this._nTransparentTriangles = 0;
        /**
         * An associative array storing ModelContextProperties objects for each
         * context this mesh is associated with, organized by the names of the
         * contexts.
         * @type Object.<String, MeshContextProperties>
         */
        this._contextProperties = {};
        /**
         * The default texture coordinates for newly added triangles and quads.
         * @type Number[4][2]
         */
        this._texCoords = [[0, 1], [1, 1], [1, 0], [0, 0]];
        /**
         * The default group indices for newly added triangles and lines.
         * @type Number
         */
        this._currentGroupIndices = [0, 0];
        /**
         * A property for convenience and optimization, all filler null vectors
         * point to this object instead of creating a separate vertex object
         * for each.
         * @type Vertex
         */
        this._nullVertex = new Vertex(0.0, 0.0, 0.0);
    }
    /**
     * Returns the number of lines this model contains.
     * @returns {Number}
     */
    Mesh.prototype.getNumLines = function () {
        return this._lines.length;
    };
    /**
     * Returns the number of completely opaque triangles this model contains.
     * @returns {Number}
     */
    Mesh.prototype.getNumOpaqueTriangles = function () {
        return this._nOpaqueTriangles;
    };
    /**
     * Returns the number of transparent (not completely opaque) triangles this 
     * model contains.
     * @returns {Number}
     */
    Mesh.prototype.getNumTransparentTriangles = function () {
        return this._nTransparentTriangles;
    };
    /**
     * Returns the number of triangles this model contains.
     * @param {Boolean} [transparent] Whether to count the transparent or the opaque triangles. If not given, both will be counted.
     * @returns {Number}
     */
    Mesh.prototype.getNumTriangles = function (transparent) {
        if (transparent === undefined) {
            return this._triangles.length;
        }
        return transparent ? this._nTransparentTriangles : this._nOpaqueTriangles;
    };
    /**
     * Resets all data stored in the mesh, so a new geometry can be built inside
     * this object.
     */
    Mesh.prototype.resetMesh = function () {
        this.resetVertices();
        this.resetLines();
        this.resetTriangles();
    };
    /**
     * Deletes the vertices of the mesh and resets related properties.
     */
    Mesh.prototype.resetVertices = function () {
        this._vertices = [];
        this._maxX = 0;
        this._minX = 0;
        this._maxY = 0;
        this._minY = 0;
        this._maxZ = 0;
        this._minZ = 0;
    };
    /**
     * Sets the vertex data belonging to the passed index.
     * @param {Number} index The index of the vertex to create/overwrite. Can
     * be bigger than the currently available indices, in which case the needed
     * new vertices will be created at (0;0;0).
     * @param {Vertex} vertex
     */
    Mesh.prototype.setVertex = function (index, vertex) {
        var i, distance;
        // if we are setting a vertex with a higher index than the currently stored
        // ones, create new vertices in between
        if (this._vertices.length < index) {
            for (i = this._vertices.length; i < index; i++) {
                this._vertices[i] = this._nullVertex;
            }
        }
        // set the vertex
        this._vertices[index] = vertex;
        // update the size related data
        distance = vec.length3([this._vertices[index].x, this._vertices[index].y, this._vertices[index].z]);
        if (2 * distance > this._size) {
            this._size = 2 * distance;
        }
        if (this._vertices[index].x > this._maxX) {
            this._maxX = this._vertices[index].x;
        }
        if (this._vertices[index].x < this._minX) {
            this._minX = this._vertices[index].x;
        }
        if (this._vertices[index].y > this._maxY) {
            this._maxY = this._vertices[index].y;
        }
        if (this._vertices[index].y < this._minY) {
            this._minY = this._vertices[index].y;
        }
        if (this._vertices[index].z > this._maxZ) {
            this._maxZ = this._vertices[index].z;
        }
        if (this._vertices[index].z < this._minZ) {
            this._minZ = this._vertices[index].z;
        }
    };
    /**
     * Adds a new vertex to the first available index.
     * @param {Number[3]} position
     * @param {Number[2]} [texCoords]
     */
    Mesh.prototype.appendVertex = function (position, texCoords) {
        this.setVertex(this._vertices.length, new Vertex(position[0], position[1], position[2], texCoords));
    };
    /**
     * Deletes the lines of the mesh.
     */
    Mesh.prototype.resetLines = function () {
        this._lines = [];
    };
    /**
     * Adds a new line to the mesh. Does not check if the same line already
     * exists.
     * @param {Line} line
     */
    Mesh.prototype.addLine = function (line) {
        this._lines.push(line);
    };
    /**
     * Replaces the line stored at the given index with a new one.
     * @param {Number} index
     * @param {Line} line
     */
    Mesh.prototype.setLine = function (index, line) {
        this._lines[index] = line;
    };
    /**
     * Deletes the triangles of the mesh and resets related properties.
     */
    Mesh.prototype.resetTriangles = function () {
        this._triangles = [];
        this._nOpaqueTriangles = 0;
        this._nTransparentTriangles = 0;
    };
    /**
     * Returns a vector pointing from one vertex to the other.
     * @param {Vertex} vertex1Index The index of the vertex that is at the origin of
     * the vector.
     * @param {Vertex} vertex2Index The index of the vertex that is at the descitation
     * of the vector.
     * @returns {Number[3]}
     */
    Mesh.prototype.getVector = function (vertex1Index, vertex2Index) {
        return [
            this._vertices[vertex2Index].x - this._vertices[vertex1Index].x,
            this._vertices[vertex2Index].y - this._vertices[vertex1Index].y,
            this._vertices[vertex2Index].z - this._vertices[vertex1Index].z];
    };
    /**
     * Adds a new triangle to the mesh. Does not check if the same triangle
     * already exists. Also adds 3 lines corresponding to the edges of the 
     * triangle, unless specified otherwise in the parameters.
     * @param {Triangle} triangle
     * @param {Boolean} [withoutLines=false]
     */
    Mesh.prototype.addTriangle = function (triangle, withoutLines) {
        this._triangles.push(triangle);
        // the default setting is to also add the corresponding border lines of the triangle
        if (!withoutLines) {
            this._lines.push(new Line(triangle.a, triangle.b, triangle.color, triangle.getNormal(0)));
            this._lines.push(new Line(triangle.b, triangle.c, triangle.color, triangle.getNormal(0)));
            this._lines.push(new Line(triangle.c, triangle.a, triangle.color, triangle.getNormal(0)));
        }
        // important to update the appropriate count
        if (triangle.color[3] < 1.0) {
            this._nTransparentTriangles++;
        } else {
            this._nOpaqueTriangles++;
        }
    };
    /**
     * @typedef {Object} Mesh~TriangleParams
     * @property {Number[4]} color 
     * @property {Boolean} useVertexTexCoords Whether to take the texture coordinates from the vertices of the model (if not, the default 
     * ones set for the model or the custom ones given will be used)
     * @property {Number[3][2]} texCoords The texture coordinates of the vertices of the triangle
     * @property {Number[][3]} normals The normal vector(s) for the triangle. If one vector is given, it will be used for all three 
     * vertices, if 3 are given, they will be used separately. If none are given, the normal of th surface of the triangles will be 
     * generated and used.
     * @property {Number[2]} groupIndices The indices of the groups to which to add the triangle.
     */
    /**
     * Creates a triangle using the supplied and the default editing parameters
     * and adds it to the mesh.
     * @param {Number} a The index of the first vertex of the triangle.
     * @param {Number} b The index of the second vertex of the triangle.
     * @param {Number} c The index of the third vertex of the triangle.
     * @param {Mesh~TriangleParams} params The parameters of the triangle. 
     * @returns {Triangle} The added triangle
     */
    Mesh.prototype.addTriangleWithParams = function (a, b, c, params) {
        var color, texCoords, normals, groupIndices, triangle;
        // the default color is opaque white
        color = params.color || [1.0, 1.0, 1.0, 1.0];
        // texture coordinates may be taken from the vertices, from the parameters
        // passed to this function or from the default coordinates set for the model
        texCoords = params.useVertexTexCoords ?
                [this._vertices[a].getTexCoords(), this._vertices[b].getTexCoords(), this._vertices[c].getTexCoords()] :
                (params.texCoords || [this._texCoords[0], this._texCoords[1], this._texCoords[2]]);
        // normals are taken from the parameters - can be 1 or 3 element long
        normals = params.normals;
        // if not specified, use the model's default group index
        groupIndices = params.groupIndices || this._currentGroupIndices;
        // create and add the new triangle
        triangle = new Triangle(this, a, b, c, color, texCoords, normals, groupIndices);
        this.addTriangle(triangle, params.withoutLines);
        return triangle;
    };
    /**
     * Adds two triangles forming a quadrilateral between 4 vertices.
     * @param {Number} a The index of the first vertex of the quad.
     * @param {Number} b The index of the second vertex of the quad.
     * @param {Number} c The index of the third vertex of the quad.
     * @param {Number} d The index of the fourth vertex of the quad.
     * @param {Mesh~TriangleParams} params The parameters of the quad in the same format as with
     * single triangles.
     */
    Mesh.prototype.addQuad = function (a, b, c, d, params) {
        var triangle1Params, triangle2Params, color, normals;
        params = params || {};
        // adding the first triangle
        // first, create the approrpiate parameters for the triangle based on the
        // parameters given for the quad
        triangle1Params = Object.create(params);
        // no lines should be added, as we will add the 4 lines for the whole quad
        // in the end
        triangle1Params.withoutLines = true;
        // for texture coordinates and normals, the first 3 values need to be used
        triangle1Params.texCoords = params.useVertexTexCoords ?
                [this._vertices[a].getTexCoords(), this._vertices[b].getTexCoords(), this._vertices[c].getTexCoords()] :
                (params.texCoords ?
                        [params.texCoords[0], params.texCoords[1], params.texCoords[2]] :
                        [this._texCoords[0], this._texCoords[1], this._texCoords[2]]);
        triangle1Params.normals = params.normals ?
                (params.normals.length === 4 ?
                        [params.normals[0], params.normals[1], params.normals[2]] :
                        params.normals) :
                null;
        this.addTriangleWithParams(a, b, c, triangle1Params);
        // adding the first triangle
        triangle2Params = Object.create(params);
        triangle2Params.texCoords = params.useVertexTexCoords ?
                [this._vertices[c].getTexCoords(), this._vertices[d].getTexCoords(), this._vertices[a].getTexCoords()] :
                (params.texCoords ?
                        [params.texCoords[2], params.texCoords[3], params.texCoords[0]] :
                        [this._texCoords[2], this._texCoords[3], this._texCoords[0]]);
        triangle2Params.normals = params.normals ?
                (params.normals.length === 4 ?
                        [params.normals[2], params.normals[3], params.normals[0]] :
                        params.normals) :
                null;
        this.addTriangleWithParams(c, d, a, triangle2Params);
        // adding the 4 lines around the quad
        if (!params.withoutLines) {
            color = params.color || [1.0, 1.0, 1.0, 1.0];
            normals = params.normals ? params.normals[0] : this._triangles[this._triangles.length - 1].getNormal(0);
            this._lines.push(new Line(a, b, color, normals));
            this._lines.push(new Line(b, c, color, normals));
            this._lines.push(new Line(c, d, color, normals));
            this._lines.push(new Line(d, a, color, normals));
        }
    };
    /**
     * Returns the size of the model, which is calculated as the double of the
     * farthest (X,Y or Z) vertex coordinate to be found in the model.
     * @returns {Number}
     */
    Mesh.prototype.getSize = function () {
        return this._size;
    };
    /**
     * Returns the greatest positive X vertex coordinate to be found in the model.
     * @returns {Number}
     */
    Mesh.prototype.getMaxX = function () {
        return this._maxX;
    };
    /**
     * Returns the greatest negative X vertex coordinate to be found in the model.
     * @returns {Number}
     */
    Mesh.prototype.getMinX = function () {
        return this._minX;
    };
    /**
     * Returns the greatest positive Y vertex coordinate to be found in the model.
     * @returns {Number}
     */
    Mesh.prototype.getMaxY = function () {
        return this._maxY;
    };
    /**
     * Returns the greatest negative Y vertex coordinate to be found in the model.
     * @returns {Number}
     */
    Mesh.prototype.getMinY = function () {
        return this._minY;
    };
    /**
     * Returns the greatest positive Z vertex coordinate to be found in the model.
     * @returns {Number}
     */
    Mesh.prototype.getMaxZ = function () {
        return this._maxZ;
    };
    /**
     * Returns the greatest negative Z vertex coordinate to be found in the model.
     * @returns {Number}
     */
    Mesh.prototype.getMinZ = function () {
        return this._minZ;
    };
    /**
     * Returns the width of the model, which is calculated as the difference
     * between the smallest and greatest X coordinates found among the vertices.
     * @returns {Number}
     */
    Mesh.prototype.getWidth = function () {
        return this._maxX - this._minX;
    };
    /**
     * Returns the height of the model, which is calculated as the difference
     * between the smallest and greatest Y coordinates found among the vertices.
     * @returns {Number}
     */
    Mesh.prototype.getHeight = function () {
        return this._maxY - this._minY;
    };
    /**
     * Returns the depth of the model, which is calculated as the difference
     * between the smallest and greatest Z coordinates found among the vertices.
     * @returns {Number}
     */
    Mesh.prototype.getDepth = function () {
        return this._maxZ - this._minZ;
    };
    /**
     * Returns the vertex buffer data for this model, organized in an associative
     * array by the roles of the different data (e.g. position, texCoord)
     * @param {Boolean} wireframe Whether the data for wireframe rendering (lines)
     * needs to be returned.
     * @param {Number} [startIndex=0] The starting index where the buffer data
     * will be used (inside a bigger buffer with data from multiple models).
     * Triangles can be indexed uniquely across all models by requesting the
     * model data with the right start index for each.
     * @returns {Object} An associative array, with all the buffer data for this
     * model. (Float32Arrays)
     * The names of the properties correspond to the roles of each of the arrays:
     * position, texCoord, normal, color, groupIndices.
     * The dataSize property contains the number of vertices.
     */
    Mesh.prototype.getBufferData = function (wireframe, startIndex) {
        var i, j, nLines, nTriangles, ix, index,
                vertexData, texCoordData, normalData, colorData,
                groupIndexData, triangleIndexData, result;
        startIndex = startIndex || 0;
        if (wireframe === true) {
            nLines = this._lines.length;
            vertexData = new Float32Array(nLines * 6);
            for (i = 0; i < nLines; i++) {
                vertexData[i * 6] = this._vertices[this._lines[i].a].x;
                vertexData[i * 6 + 1] = this._vertices[this._lines[i].a].y;
                vertexData[i * 6 + 2] = this._vertices[this._lines[i].a].z;
                vertexData[i * 6 + 3] = this._vertices[this._lines[i].b].x;
                vertexData[i * 6 + 4] = this._vertices[this._lines[i].b].y;
                vertexData[i * 6 + 5] = this._vertices[this._lines[i].b].z;
            }
            texCoordData = new Float32Array(nLines * 4);
            for (i = 0; i < nLines; i++) {
                texCoordData[i * 4] = 0.0;
                texCoordData[i * 4 + 1] = 1.0;
                texCoordData[i * 4 + 2] = 1.0;
                texCoordData[i * 4 + 3] = 1.0;
            }
            normalData = new Float32Array(nLines * 6);
            for (i = 0; i < nLines; i++) {
                normalData[i * 6] = this._lines[i].normal[0];
                normalData[i * 6 + 1] = this._lines[i].normal[1];
                normalData[i * 6 + 2] = this._lines[i].normal[2];
                normalData[i * 6 + 3] = this._lines[i].normal[0];
                normalData[i * 6 + 4] = this._lines[i].normal[1];
                normalData[i * 6 + 5] = this._lines[i].normal[2];
            }
            colorData = new Float32Array(nLines * 8);
            for (i = 0; i < nLines; i++) {
                colorData[i * 8] = this._lines[i].color[0];
                colorData[i * 8 + 1] = this._lines[i].color[1];
                colorData[i * 8 + 2] = this._lines[i].color[2];
                colorData[i * 8 + 3] = 1.0;
                colorData[i * 8 + 4] = this._lines[i].color[0];
                colorData[i * 8 + 5] = this._lines[i].color[1];
                colorData[i * 8 + 6] = this._lines[i].color[2];
                colorData[i * 8 + 7] = 1.0;
            }
            groupIndexData = new Float32Array(nLines * 4);
            for (i = 0; i < nLines; i++) {
                groupIndexData[i * 4] = 0;
                groupIndexData[i * 4 + 1] = 0;
                groupIndexData[i * 4 + 2] = 0;
                groupIndexData[i * 4 + 3] = 0;
            }
            nTriangles = this._triangles.length;
            triangleIndexData = new Float32Array(nTriangles * 3);
            for (i = 0; i < nTriangles; i++) {
                triangleIndexData[i * 12] = 0;
                triangleIndexData[i * 12 + 1] = 0;
                triangleIndexData[i * 12 + 2] = 0;
                triangleIndexData[i * 12 + 3] = 0;
                triangleIndexData[i * 12 + 4] = 0;
                triangleIndexData[i * 12 + 5] = 0;
                triangleIndexData[i * 12 + 6] = 0;
                triangleIndexData[i * 12 + 7] = 0;
                triangleIndexData[i * 12 + 8] = 0;
                triangleIndexData[i * 12 + 9] = 0;
                triangleIndexData[i * 12 + 10] = 0;
                triangleIndexData[i * 12 + 11] = 0;
            }
        } else {
            nTriangles = this._triangles.length;
            vertexData = new Float32Array(nTriangles * 9);
            for (i = 0; i < nTriangles; i++) {
                vertexData[i * 9] = this._vertices[this._triangles[i].a].x;
                vertexData[i * 9 + 1] = this._vertices[this._triangles[i].a].y;
                vertexData[i * 9 + 2] = this._vertices[this._triangles[i].a].z;
                vertexData[i * 9 + 3] = this._vertices[this._triangles[i].b].x;
                vertexData[i * 9 + 4] = this._vertices[this._triangles[i].b].y;
                vertexData[i * 9 + 5] = this._vertices[this._triangles[i].b].z;
                vertexData[i * 9 + 6] = this._vertices[this._triangles[i].c].x;
                vertexData[i * 9 + 7] = this._vertices[this._triangles[i].c].y;
                vertexData[i * 9 + 8] = this._vertices[this._triangles[i].c].z;
            }
            texCoordData = new Float32Array(nTriangles * 6);
            for (i = 0; i < nTriangles; i++) {
                texCoordData[i * 6] = this._triangles[i].texCoords[0][0];
                texCoordData[i * 6 + 1] = this._triangles[i].texCoords[0][1];
                texCoordData[i * 6 + 2] = this._triangles[i].texCoords[1][0];
                texCoordData[i * 6 + 3] = this._triangles[i].texCoords[1][1];
                texCoordData[i * 6 + 4] = this._triangles[i].texCoords[2][0];
                texCoordData[i * 6 + 5] = this._triangles[i].texCoords[2][1];
            }
            normalData = new Float32Array(nTriangles * 9);
            for (i = 0; i < nTriangles; i++) {
                normalData[i * 9] = this._triangles[i].getNormal(0)[0];
                normalData[i * 9 + 1] = this._triangles[i].getNormal(0)[1];
                normalData[i * 9 + 2] = this._triangles[i].getNormal(0)[2];
                normalData[i * 9 + 3] = this._triangles[i].getNormal(1)[0];
                normalData[i * 9 + 4] = this._triangles[i].getNormal(1)[1];
                normalData[i * 9 + 5] = this._triangles[i].getNormal(1)[2];
                normalData[i * 9 + 6] = this._triangles[i].getNormal(2)[0];
                normalData[i * 9 + 7] = this._triangles[i].getNormal(2)[1];
                normalData[i * 9 + 8] = this._triangles[i].getNormal(2)[2];
            }
            colorData = new Float32Array(nTriangles * 12);
            for (i = 0; i < nTriangles; i++) {
                colorData[i * 12] = this._triangles[i].color[0];
                colorData[i * 12 + 1] = this._triangles[i].color[1];
                colorData[i * 12 + 2] = this._triangles[i].color[2];
                colorData[i * 12 + 3] = this._triangles[i].color[3];
                colorData[i * 12 + 4] = this._triangles[i].color[0];
                colorData[i * 12 + 5] = this._triangles[i].color[1];
                colorData[i * 12 + 6] = this._triangles[i].color[2];
                colorData[i * 12 + 7] = this._triangles[i].color[3];
                colorData[i * 12 + 8] = this._triangles[i].color[0];
                colorData[i * 12 + 9] = this._triangles[i].color[1];
                colorData[i * 12 + 10] = this._triangles[i].color[2];
                colorData[i * 12 + 11] = this._triangles[i].color[3];
            }
            groupIndexData = new Float32Array(nTriangles * 6);
            for (i = 0; i < nTriangles; i++) {
                groupIndexData[i * 6] = this._triangles[i].groupIndices[0];
                groupIndexData[i * 6 + 1] = this._triangles[i].groupIndices[1];
                groupIndexData[i * 6 + 2] = this._triangles[i].groupIndices[0];
                groupIndexData[i * 6 + 3] = this._triangles[i].groupIndices[1];
                groupIndexData[i * 6 + 4] = this._triangles[i].groupIndices[0];
                groupIndexData[i * 6 + 5] = this._triangles[i].groupIndices[1];
            }
            triangleIndexData = new Float32Array(nTriangles * 12);
            for (i = 0; i < nTriangles; i++) {
                ix = startIndex + i;
                index = [];
                for (j = 0; j < 4; j++) {
                    index[j] = (ix % 256) / 255.0;
                    ix = Math.floor(ix / 256.0);
                }
                triangleIndexData[i * 12] = index[0];
                triangleIndexData[i * 12 + 1] = index[1];
                triangleIndexData[i * 12 + 2] = index[2];
                triangleIndexData[i * 12 + 3] = index[3];
                triangleIndexData[i * 12 + 4] = index[0];
                triangleIndexData[i * 12 + 5] = index[1];
                triangleIndexData[i * 12 + 6] = index[2];
                triangleIndexData[i * 12 + 7] = index[3];
                triangleIndexData[i * 12 + 8] = index[0];
                triangleIndexData[i * 12 + 9] = index[1];
                triangleIndexData[i * 12 + 10] = index[2];
                triangleIndexData[i * 12 + 11] = index[3];
            }
        }
        result = {};
        result[VertexAttributeRole.POSITION] = vertexData;
        result[VertexAttributeRole.TEXTURE_COORDINATES] = texCoordData;
        result[VertexAttributeRole.NORMAL] = normalData;
        result[VertexAttributeRole.COLOR] = colorData;
        result[VertexAttributeRole.GROUP_INDICES] = groupIndexData;
        result[VertexAttributeRole.TRIANGLE_INDEX] = triangleIndexData;
        result.dataSize = (wireframe ? this._lines.length * 2 : this._triangles.length * 3);
        return result;
    };
    /**
     * Returns the size of the vertex buffer data (number of vertices) that this
     * mesh has for the specified context.
     * @param {Boolean} wireframe
     * @param {Boolean} solid
     * @returns {Number}
     */
    Mesh.prototype.getBufferSize = function (wireframe, solid) {
        return (wireframe ? this._lines.length * 2 : 0) + (solid ? this._triangles.length * 3 : 0);
    };
    /**
     * Loads the model's vertex data into the vertex buffer objects of the specified
     * context. Data for wireframe and solid rendering is added based on whether
     * the model has been previously added to the context in the respective mode.
     * @param {ManagedGLContext} context
     * @param {Number} startIndex The data will be added starting from this 
     * vertex index within the buffer objects.
     * @param {Boolean} wireframe
     * @param {Boolean} solid
     * @returns {Number} The number of vertices for which data has been added.
     */
    Mesh.prototype.loadToVertexBuffers = function (context, startIndex, wireframe, solid) {
        var bufferData = null,
                dataSize = 0,
                props = this._contextProperties[context.getName()] || new MeshContextProperties();
        if (wireframe) {
            bufferData = this.getBufferData(true, startIndex);
            props.bufferStartWireframe = startIndex;
            context.setVertexBufferData(bufferData, startIndex);
            dataSize += bufferData.dataSize;
            startIndex += bufferData.dataSize;
        }
        if (solid) {
            bufferData = this.getBufferData(false, startIndex);
            props.bufferStartSolid = startIndex;
            props.bufferStartTransparent = startIndex + this._nOpaqueTriangles * 3;
            context.setVertexBufferData(bufferData, startIndex);
            dataSize += bufferData.dataSize;
            startIndex += bufferData.dataSize;
        }
        this._contextProperties[context.getName()] = props;
        return dataSize;
    };
    /**
     * Renders the model within the passed context, with the specified rendering
     * mode (wireframe or solid).
     * @param {ManagedGLContext} context The context into which the model is to
     * be rendered. The model has to be added to this context previously in the
     * same rendering mode, and the context needs to be set up afterwards for
     * rendering.
     * @param {Boolean} wireframe Whether the model should be rendered in 
     * wireframe mode.
     * @param {Boolean} opaque Whether only the opaque parts of the model should be
     * rendered. False means only transparent parts, and undefined (omitted) means
     * the whole model. Only effective in solid rendering mode.
     */
    Mesh.prototype.render = function (context, wireframe, opaque) {
        var props = this._contextProperties[context.getName()];
        if (wireframe === true) {
            context.gl.drawArrays(context.gl.LINES, props.bufferStartWireframe, 2 * this._lines.length);
            _DEBUG_STATS.lineDrawCalls++;
            _DEBUG_STATS.lines += this._lines.length;
            //context.gl.drawElements(context.gl.LINES, 2 * this._lines.length, context.gl.UNSIGNED_SHORT, props.bufferStartWireframe * 2);
        } else {
            switch (opaque) {
                case true:
                    context.gl.drawArrays(context.gl.TRIANGLES, props.bufferStartSolid, 3 * this._nOpaqueTriangles);
                    _DEBUG_STATS.triangles += this._nOpaqueTriangles;
                    //context.gl.drawElements(context.gl.TRIANGLES, 3 * this._nOpaqueTriangles, context.gl.UNSIGNED_SHORT, props.bufferStartSolid * 2);
                    break;
                case false:
                    context.gl.drawArrays(context.gl.TRIANGLES, props.bufferStartTransparent, 3 * this._nTransparentTriangles);
                    _DEBUG_STATS.triangles += this._nTransparentTriangles;
                    //context.gl.drawElements(context.gl.TRIANGLES, 3 * this._nTransparentTriangles, context.gl.UNSIGNED_SHORT, props.bufferStartTransparent * 2);
                    break;
                case undefined:
                    context.gl.drawArrays(context.gl.TRIANGLES, props.bufferStartSolid, 3 * this._triangles.length);
                    _DEBUG_STATS.triangles += this._triangles.length;
                    //context.gl.drawElements(context.gl.TRIANGLES, 3 * this._triangles.length, context.gl.UNSIGNED_SHORT, props.bufferStartSolid * 2);
                    break;
            }
            _DEBUG_STATS.triangleDrawCalls++;
        }
    };
    /**
     * Similar to the regular render method, but this renders the given number of instances of the mesh using instancing.
     * @param {ManagedGLContext} context
     * @param {Boolean} wireframe
     * @param {Boolean} [opaque]
     * @param {Number} instanceCount
     */
    Mesh.prototype.renderInstances = function (context, wireframe, opaque, instanceCount) {
        var props = this._contextProperties[context.getName()];
        if (wireframe === true) {
            context.instancingExt.drawArraysInstancedANGLE(context.gl.LINES, props.bufferStartWireframe, 2 * this._lines.length, instanceCount);
            _DEBUG_STATS.instancedLineDrawCalls++;
            _DEBUG_STATS.instancedLines += this._lines.length * instanceCount;
        } else {
            switch (opaque) {
                case true:
                    context.instancingExt.drawArraysInstancedANGLE(context.gl.TRIANGLES, props.bufferStartSolid, 3 * this._nOpaqueTriangles, instanceCount);
                    _DEBUG_STATS.instancedTriangles += this._nOpaqueTriangles * instanceCount;
                    break;
                case false:
                    context.instancingExt.drawArraysInstancedANGLE(context.gl.TRIANGLES, props.bufferStartTransparent, 3 * this._nTransparentTriangles, instanceCount);
                    _DEBUG_STATS.instancedTriangles += this._nTransparentTriangles * instanceCount;
                    break;
                case undefined:
                    context.instancingExt.drawArraysInstancedANGLE(context.gl.TRIANGLES, props.bufferStartSolid, 3 * this._triangles.length, instanceCount);
                    _DEBUG_STATS.instancedTriangles += this._triangles.length * instanceCount;
                    break;
            }
            _DEBUG_STATS.instancedTriangleDrawCalls++;
        }
    };
    /**
     * Adds a cuboid geometry to the object. (both vertices and faces)
     * @param {Number} x The X coordinate of the center of the cuboid.
     * @param {Number} y The Y coordinate of the center of the cuboid.
     * @param {Number} z The Z coordinate of the center of the cuboid.
     * @param {Number} width The width (X dimension) of the cuboid.
     * @param {Number} height The height (Y dimension) of the cuboid.
     * @param {Number} depth The depth (Z dimension) of the cuboid.
     * @param {Number[4]} color The color of the faces of the cuboid 
     * ([red,green,blue,alpha])
     * @param {Number[4][2]} textureCoordinates The texture coordinates for the 
     * faces of the cuboid (the two coordinates for each of the 4 vertices of one
     * face.
     * @param {Boolean} cullFace Whether the faces facing the inside of the cuboid
     * should be culled (omitted)
     */
    Mesh.prototype.addCuboid = function (x, y, z, width, height, depth, color, textureCoordinates, cullFace) {
        var i, i0, normals, params;
        i0 = +this._vertices.length;

        // front
        this.appendVertex([x - width / 2, y - height / 2, z + depth / 2]);
        this.appendVertex([x + width / 2, y - height / 2, z + depth / 2]);
        this.appendVertex([x + width / 2, y + height / 2, z + depth / 2]);
        this.appendVertex([x - width / 2, y + height / 2, z + depth / 2]);
        // back
        this.appendVertex([x - width / 2, y + height / 2, z - depth / 2]);
        this.appendVertex([x + width / 2, y + height / 2, z - depth / 2]);
        this.appendVertex([x + width / 2, y - height / 2, z - depth / 2]);
        this.appendVertex([x - width / 2, y - height / 2, z - depth / 2]);
        // top
        this.appendVertex([x + width / 2, y + height / 2, z - depth / 2]);
        this.appendVertex([x - width / 2, y + height / 2, z - depth / 2]);
        this.appendVertex([x - width / 2, y + height / 2, z + depth / 2]);
        this.appendVertex([x + width / 2, y + height / 2, z + depth / 2]);
        // bottom
        this.appendVertex([x - width / 2, y - height / 2, z - depth / 2]);
        this.appendVertex([x + width / 2, y - height / 2, z - depth / 2]);
        this.appendVertex([x + width / 2, y - height / 2, z + depth / 2]);
        this.appendVertex([x - width / 2, y - height / 2, z + depth / 2]);
        // right
        this.appendVertex([x + width / 2, y - height / 2, z - depth / 2]);
        this.appendVertex([x + width / 2, y + height / 2, z - depth / 2]);
        this.appendVertex([x + width / 2, y + height / 2, z + depth / 2]);
        this.appendVertex([x + width / 2, y - height / 2, z + depth / 2]);
        // left
        this.appendVertex([x - width / 2, y + height / 2, z - depth / 2]);
        this.appendVertex([x - width / 2, y - height / 2, z - depth / 2]);
        this.appendVertex([x - width / 2, y - height / 2, z + depth / 2]);
        this.appendVertex([x - width / 2, y + height / 2, z + depth / 2]);

        normals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
        params = {
            color: color,
            texCoords: textureCoordinates
        };

        for (i = 0; i < 6; i++) {
            params.normals = [normals[i]];
            this.addQuad(i0 + (i * 4), i0 + (i * 4) + 1, i0 + (i * 4) + 2, i0 + (i * 4) + 3, params);
            if (!cullFace) {
                params.normals = [vec.scaled3(normals[i], -1)];
                this.addQuad(i0 + (i * 4) + 2, i0 + (i * 4) + 1, i0 + (i * 4), i0 + (i * 4) + 3, params);
            }
        }

    };
    /**
     * Returns 2D coordinates of a point within a specified rectangular area 
     * based on the relative position of the point within that rectangle.
     * @param {Number} left The X coordinate of the left edge of the rectangle.
     * @param {Number} bottom The Y coordinate of the bottom edge of the rectangle.
     * @param {Number} right The X coordinate of the right edge of the rectangle.
     * @param {Number} top The Y coordinate of the top edge of the rectangle.
     * @param {Number} relativeX The relative X coordinate of the point within
     * the rectangle (0.0-1.0)
     * @param {Number} relativeY The relative Y coordinate of the point within
     * the rectangle (0.0-1.0)
     * @returns {Number[2]}
     */
    function uvCoordsOnTexture(left, bottom, right, top, relativeX, relativeY) {
        var result = [0, 0];
        result[0] = left + (right - left) * relativeX;
        result[1] = bottom + (top - bottom) * relativeY;
        return result;
    }
    /**
     * Adds vertices and triangles that form a sphere (UV sphere).
     * @param {Number} x The X coordinate of the center.
     * @param {Number} y The Y coordinate of the center.
     * @param {Number} z The Z coordinate of the center.
     * @param {Number} radius The radius of the sphere.
     * @param {Number} angles The number of angles one circle should have within the sphere.
     * @param {Number[4]} color The RGBA components of the desired color of the triangles.
     * @param {Number[4][2]} textureCoordinates The coordinate pairs of the texture to map to the sphere: from bottom left counter-clockwise
     * @param {Boolean} cullFace Whether to omit the triangles from the inside of the sphere.
     */
    Mesh.prototype.addSphere = function (x, y, z, radius, angles, color, textureCoordinates, cullFace) {
        var i, i0, j, v, uv1, uv2, uv3, n1, n2, n3;
        // circles with vertices indexed starting from the top, starting from XY and spinned around axis Y
        for (i = 0; i < angles; i++) {
            for (j = 0; j < angles; j++) {
                this.appendVertex([x + radius * Math.sin(j * 2 * Math.PI / angles) * Math.cos(i * 2 * Math.PI / angles), y + radius * Math.cos(j * 2 * Math.PI / angles), z + radius * Math.sin(i * 2 * Math.PI / angles) * Math.sin(j * 2 * Math.PI / angles)]);
            }
        }

        i0 = this._vertices.length - angles * angles;

        if ((angles % 2) === 1) {
            this._vertices[i0 + (angles + 1) / 2].setX(x);
            this._vertices[i0 + (angles + 1) / 2].setZ(z);
        }

        for (i = 0; i < angles; i++) {
            // adding triangles connected to the top
            // the vertex indices:
            v = [i0 + (i * angles), i0 + (((i + 1) % angles) * angles) + 1, i0 + (i * angles) + 1];
            // the UV texture coordinates:
            uv1 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], 1 / (2 * angles) + (i / angles), 1);
            uv2 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], (i + 1) / angles, 1 - 2 / angles);
            uv3 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], i / angles, 1 - 2 / angles);
            // the normal vectors:
            n1 = [(this._vertices[v[0]].x - x) / radius, (this._vertices[v[0]].y - y) / radius, (this._vertices[v[0]].z - z) / radius];
            n2 = [(this._vertices[v[1]].x - x) / radius, (this._vertices[v[1]].y - y) / radius, (this._vertices[v[1]].z - z) / radius];
            n3 = [(this._vertices[v[2]].x - x) / radius, (this._vertices[v[2]].y - y) / radius, (this._vertices[v[2]].z - z) / radius];
            this.addTriangleWithParams(v[0], v[1], v[2], {color: color,
                texCoords: [uv1, uv2, uv3],
                normals: [n1, n2, n3]});
            if (cullFace !== true) {
                this.addTriangleWithParams(v[0], v[2], v[1], {color: color,
                    texCoords: [uv1, uv3, uv2],
                    normals: [vec.scaled3(n1, -1), vec.scaled3(n3, -1), vec.scaled3(n2, -1)]});
            }
            // triangles connected to the bottom
            if ((angles % 2) === 0) {
                v = [i0 + (i * angles) + angles / 2, i0 + (i * angles) + angles / 2 - 1, i0 + (((i + 1) % angles) * angles) + angles / 2 - 1];
            } else {
                v = [i0 + (angles + 1) / 2, i0 + (i * angles) + (angles - 1) / 2, i0 + (((i + 1) % angles) * angles) + (angles - 1) / 2];
            }
            uv1 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], 1 / (2 * angles) + (i / angles), 0);
            uv2 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], i / angles, ((angles % 2) === 0) ? 2 / angles : 1 / angles);
            uv3 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], (i + 1) / angles, ((angles % 2) === 0) ? 2 / angles : 1 / angles);
            n1 = [(this._vertices[v[0]].x - x) / radius, (this._vertices[v[0]].y - y) / radius, (this._vertices[v[0]].z - z) / radius];
            n2 = [(this._vertices[v[1]].x - x) / radius, (this._vertices[v[1]].y - y) / radius, (this._vertices[v[1]].z - z) / radius];
            n3 = [(this._vertices[v[2]].x - x) / radius, (this._vertices[v[2]].y - y) / radius, (this._vertices[v[2]].z - z) / radius];
            this.addTriangleWithParams(v[0], v[1], v[2], {color: color,
                texCoords: [uv1, uv2, uv3],
                normals: [n1, n2, n3]});
            if (cullFace !== true) {
                this.addTriangleWithParams(v[0], v[2], v[1], {color: color,
                    texCoords: [uv1, uv3, uv2],
                    normals: [vec.scaled3(n1, -1), vec.scaled3(n3, -1), vec.scaled3(n2, -1)]});
            }
            // quads between the two subsequent circles
            for (j = 1; j < angles / 2 - 1; j++) {
                v = [i0 + (i * angles) + j, i0 + (((i + 1) % angles) * angles) + j + 1, i0 + (i * angles) + j + 1];
                uv1 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], i / angles, 1 - 2 * j / angles);
                uv2 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], (i + 1) / angles, 1 - 2 * (j + 1) / angles);
                uv3 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], i / angles, 1 - 2 * (j + 1) / angles);
                n1 = [(this._vertices[v[0]].x - x) / radius, (this._vertices[v[0]].y - y) / radius, (this._vertices[v[0]].z - z) / radius];
                n2 = [(this._vertices[v[1]].x - x) / radius, (this._vertices[v[1]].y - y) / radius, (this._vertices[v[1]].z - z) / radius];
                n3 = [(this._vertices[v[2]].x - x) / radius, (this._vertices[v[2]].y - y) / radius, (this._vertices[v[2]].z - z) / radius];
                this.addTriangleWithParams(v[0], v[1], v[2], {color: color,
                    texCoords: [uv1, uv2, uv3],
                    normals: [n1, n2, n3]});
                if (cullFace !== true) {
                    this.addTriangleWithParams(v[0], v[2], v[1], {color: color,
                        texCoords: [uv1, uv3, uv2],
                        normals: [vec.scaled3(n1, -1), vec.scaled3(n3, -1), vec.scaled3(n2, -1)]});
                }
                v = [i0 + (((i + 1) % angles) * angles) + j + 1, i0 + (i * angles) + j, i0 + (((i + 1) % angles) * angles) + j];
                uv1 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], (i + 1) / angles, 1 - 2 * (j + 1) / angles);
                uv2 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], i / angles, 1 - 2 * j / angles);
                uv3 = uvCoordsOnTexture(textureCoordinates[0][0], textureCoordinates[0][1], textureCoordinates[2][0], textureCoordinates[2][1], (i + 1) / angles, 1 - 2 * j / angles);
                n1 = [(this._vertices[v[0]].x - x) / radius, (this._vertices[v[0]].y - y) / radius, (this._vertices[v[0]].z - z) / radius];
                n2 = [(this._vertices[v[1]].x - x) / radius, (this._vertices[v[1]].y - y) / radius, (this._vertices[v[1]].z - z) / radius];
                n3 = [(this._vertices[v[2]].x - x) / radius, (this._vertices[v[2]].y - y) / radius, (this._vertices[v[2]].z - z) / radius];
                this.addTriangleWithParams(v[0], v[1], v[2], {color: color,
                    texCoords: [uv1, uv2, uv3],
                    normals: [n1, n2, n3]});
                if (cullFace !== true) {
                    this.addTriangleWithParams(v[0], v[2], v[1], {color: color,
                        texCoords: [uv1, uv3, uv2],
                        normals: [vec.scaled3(n1, -1), vec.scaled3(n3, -1), vec.scaled3(n2, -1)]});
                }
            }
        }
    };
    // ############################################################################################
    /**
     * @struct Stores the attributes that a model has associated with a managed
     * WebGL context.
     * @returns {ModelContextProperties}
     */
    function ModelContextProperties() {
        /**
         * Whether the wireframe model is used in the context.
         * @type Boolean
         */
        this.wireframe = false;
        /**
         * Whether the solid model is used in the context.
         * @type Boolean
         */
        this.solid = false;
        /**
         * The minimum LOD with which this model has been added to the context.
         * The vertex buffer data should be filled with the mesh data starting
         * from this LOD, when the context is initialized.
         * @type Number
         */
        this.minLOD = 0;
        /**
         * The maximum LOD with which this model has been added to the context.
         * The vertex buffer data should be filled with the mesh data up to this 
         * LOD, when the context is initialized.
         * @type Number
         */
        this.maxLOD = 0;
    }
    // ############################################################################################
    /**
     * @class Combines different Mesh object into one, multi-LOD 3D model and
     * provides functionality for loading these different LODs from a single or
     * multiple files.
     */
    function Model() {
        /**
         * The mesh ordered by their LOD (the index corresponds to the LOD of
         * the mesh)
         * @type Mesh[]
         */
        this._meshes = [];
        /**
         * The minimum LOD for which this model currently stores info. It is set
         * when mesh info is loaded from a file.
         * @type Number
         */
        this._minLOD = this.LOD_NOT_SET;
        /**
         * The maximum LOD for which this model currently stores info. It is set
         * when mesh info is loaded from a file.
         * @type Number
         */
        this._maxLOD = this.LOD_NOT_SET;
        /**
         * A convenience property holding a reference to the currently edited
         * mesh, in case a single LOD is set to be edited. Editing operations
         * affect only this mesh, if it is set.
         * @type Mesh
         */
        this._editedMesh = null;
        /**
         * Editing operations affect the meshes equal to or above this LOD.
         * @type Number
         */
        this._minEditedLOD = 0;
        /**
         * Editing operations affect the meshes up to this LOD.
         * @type Number
         */
        this._maxEditedLOD = 0;
        /**
         * The name of this model.
         * @type String
         */
        this._name = null;
        /**
         * The object storing the info (meta) properties of the model.
         * @type Object
         */
        this._infoProperties = {};
        /**
         * The length of one model-space unit in meters.
         * @type Number
         */
        this._scale = 1;
        /**
         * An associative array storing ModelContextProperties objects for each
         * context this model is associated with, organized by the names of the
         * contexts.
         * @type Object.<String, ModelContextProperties>
         */
        this._contextProperties = {};
    }
    /**
     * The value for LOD levels that have not been set yet
     * @constant
     * @type Number
     */
    Model.prototype.LOD_NOT_SET = -1;

    /**
     * Returns the name of the model. (not the same as the filename - a name can be
     * set directly, or read from the model file)
     * @returns {String}
     */
    Model.prototype.getName = function () {
        return this._name;
    };
    /**
     * Sets a name for the model.
     * @param {String} name
     */
    Model.prototype.setName = function (name) {
        this._name = name;
    };
    /**
     * Returns the minimum LOD this model has a mesh for.
     * @returns {Number}
     */
    Model.prototype.getMinLOD = function () {
        return this._minLOD;
    };
    /**
     * Returns the maximum LOD this model has a mesh for.
     * @returns {Number}
     */
    Model.prototype.getMaxLOD = function () {
        return this._maxLOD;
    };
    /**
     * Returns the LOD closest to the specified level this model has a mesh for.
     * @param {Number} lod
     * @returns {Number}
     */
    Model.prototype.getClosestAvailableLOD = function (lod) {
        return Math.min(Math.max(this.getMinLOD(), lod), this.getMaxLOD());
    };

    /**
     * Extends the covered LOD range if needed to include the passed range.
     * @param {Number} minLOD
     * @param {Number} maxLOD
     */
    Model.prototype.updateLODInfo = function (minLOD, maxLOD) {
        this._minLOD = (this._minLOD === this.LOD_NOT_SET) ? minLOD : (minLOD < this._minLOD ? minLOD : this._minLOD);
        this._maxLOD = (this._maxLOD === this.LOD_NOT_SET) ? maxLOD : (maxLOD > this._maxLOD ? maxLOD : this._maxLOD);
    };

    /**
     * Returns the mesh containing this model at the given LOD.
     * @param {Number} lod
     * @returns {Mesh}
     */
    Model.prototype.getMeshWithLOD = function (lod) {
        var i;
        for (i = this._meshes.length; i <= lod; i++) {
            this._meshes.push(new Mesh());
            this._maxLOD = i;
        }
        return this._meshes[lod];
    };

    /**
     * After calling this method, editing methods of the model will affect the 
     * mesh that contains the specified LOD.
     * @param {Number} lod
     */
    Model.prototype.startEditingMeshWithLOD = function (lod) {
        this._editedMesh = this.getMeshWithLOD(lod);
        this._minEditedLOD = lod;
        this._maxEditedLOD = lod;
    };

    /**
     * If available, returns a reference to the currently edited mesh.
     * @returns {Mesh}
     */
    Model.prototype.getCurrentlyEditedMesh = function () {
        return this._editedMesh;
    };

    /**
     * After this call, editing methods will affect meshes with LODs greater
     * than or equal to the passed value (up to the set maximum)
     * @param {Number} value
     */
    Model.prototype.setMinimumEditedLOD = function (value) {
        this._minEditedLOD = value;
        this._editedMesh = (this._minEditedLOD === this._maxEditedLOD) ? this.getMeshWithLOD(value) : null;
    };

    /**
     * After this call, editing methods will affect meshes with LODs smaller
     * than or equal to the passed value (down to the set minimum)
     * @param {Number} value
     */
    Model.prototype.setMaximumEditedLOD = function (value) {
        this._maxEditedLOD = value;
        this._editedMesh = (this._minEditedLOD === this._maxEditedLOD) ? this.getMeshWithLOD(value) : null;
    };
    /**
     * Loads the model data from the passed JSON object.
     * @param {String} filename
     * @param {Object} dataJSON
     * @param {Number} defaultLOD
     * @returns {Boolean} Whether the model has been successfully loaded.
     */
    Model.prototype.loadFromJSON = function (filename, dataJSON, defaultLOD) {
        var i, j, str,
                minLoadedLOD = null,
                maxLoadedLOD = null,
                defaultMinLOD = null,
                defaultMaxLOD = null,
                minLOD, maxLOD,
                version, colorPalette,
                params,
                nVertices, nLines, nTriangles,
                index, vertex, line, triangle, length,
                resetNewLoadedMeshes = function (newMinLoadedLOD, newMaxLoadedLOD) {
                    var lod;
                    if (minLoadedLOD === null) {
                        for (lod = newMinLoadedLOD; lod <= newMaxLoadedLOD; lod++) {
                            this.getMeshWithLOD(lod).resetMesh();
                        }
                        minLoadedLOD = newMinLoadedLOD;
                        maxLoadedLOD = newMaxLoadedLOD;
                    } else {
                        for (lod = newMinLoadedLOD; lod < minLoadedLOD; lod++) {
                            this.getMeshWithLOD(lod).resetMesh();
                        }
                        for (lod = maxLoadedLOD + 1; lod <= newMaxLoadedLOD; lod++) {
                            this.getMeshWithLOD(lod).resetMesh();
                        }
                        minLoadedLOD = newMinLoadedLOD < minLoadedLOD ? newMinLoadedLOD : minLoadedLOD;
                        maxLoadedLOD = newMaxLoadedLOD > maxLoadedLOD ? newMaxLoadedLOD : maxLoadedLOD;
                    }
                }.bind(this);
        defaultLOD = defaultLOD || 0;
        application.log_DEBUG("Loading EgomModel data from file: " + filename + " ...", 2);
        // checking the passed JSON file
        if (typeof dataJSON !== "object") {
            application.showError("'" + filename + "' does not appear to be an JSON file.",
                    application.ErrorSeverity.SEVERE,
                    "A model was supposed to be loaded from this file, but only models of EgomModel format " +
                    "are accepted. Such a file needs to be a valid XML document with an EgomModel root element or a valid JSON file.");
            return false;
        }
        // checking EgomModel version
        version = dataJSON.version;
        if (!version) {
            application.showError("Model from file: '" + filename + "' could not be loaded, because the file version could not have been determined.", application.ErrorSeverity.SEVERE);
            return false;
        }
        if (_supportedVersions.indexOf(version) < 0) {
            application.showError("Model from file: '" + filename + "' could not be loaded, because the version of the file (" + version + ") is not supported.",
                    application.ErrorSeverity.SEVERE, "Supported versions are: " + _supportedVersions.join(", ") + ".");
            return false;
        }
        // loading info properties
        colorPalette = null;
        this._infoProperties = dataJSON.info || {};
        this._name = dataJSON.info.name || null;
        this._scale = dataJSON.info.scale || 1;
        defaultMinLOD = dataJSON.info.defaultLOD[0] === null ? defaultLOD : dataJSON.info.defaultLOD[0];
        defaultMaxLOD = dataJSON.info.defaultLOD[1] === null ? defaultLOD : dataJSON.info.defaultLOD[1];
        colorPalette = dataJSON.info.colorPalette;
        // loading vertices
        nVertices = dataJSON.vertices.length;
        for (i = 0; i < nVertices; i++) {
            index = dataJSON.vertices[i][0];
            if (dataJSON.vertices[i].length >= 6) {
                minLOD = dataJSON.vertices[i][4];
                maxLOD = dataJSON.vertices[i][5];
            } else {
                minLOD = defaultMinLOD;
                maxLOD = defaultMaxLOD;
            }
            this.updateLODInfo(minLOD, maxLOD);
            resetNewLoadedMeshes(minLOD, maxLOD);
            vertex = new Vertex(dataJSON.vertices[i][1], dataJSON.vertices[i][2], dataJSON.vertices[i][3]); // x,y,z
            for (j = minLOD; j <= maxLOD; j++) {
                this.getMeshWithLOD(j).setVertex(index, vertex);
            }
        }
        application.log_DEBUG("Loaded " + nVertices + " vertices.", 3);
        // loading lines
        nLines = dataJSON.lines.length;
        for (i = 0; i < nLines; i++) {
            if (dataJSON.lines[i].length >= 8) {
                minLOD = dataJSON.lines[i][6];
                maxLOD = dataJSON.lines[i][7];
            } else {
                minLOD = defaultMinLOD;
                maxLOD = defaultMaxLOD;
            }
            this.updateLODInfo(minLOD, maxLOD);
            resetNewLoadedMeshes(minLOD, maxLOD);
            line = new Line(
                    dataJSON.lines[i][0], // a
                    dataJSON.lines[i][1], // b
                    colorPalette[dataJSON.lines[i][2]],
                    0,
                    dataJSON.lines[i].slice(3, 6)); // normal
            for (j = minLOD; j <= maxLOD; j++) {
                this.getMeshWithLOD(j).addLine(line);
            }
        }
        application.log_DEBUG("Loaded " + nLines + " lines.", 3);
        // loading triangles
        nTriangles = dataJSON.triangles.length;
        params = {};
        for (i = 0; i < nTriangles; i++) {
            // triangles are defined by 3 arrays:
            // first: [a, b, c, color, <texCoords(6)>, <lod(2)>] where texCoords are omitted if the same as for the previous triangle, lod is omitted if default
            // second: normals: one normal if same for all three vertices, three normals (flattened to 9 numbers) if different, empty array if normals are the same as previous triangle
            // third: group indices: omitted if default, empty array if the same as for the previous triangle
            length = dataJSON.triangles[i][0].length;
            if ((length === 6) || (length === 12)) { // two cases, with and without texCoords being omitted
                minLOD = dataJSON.triangles[i][0][length - 2];
                maxLOD = dataJSON.triangles[i][0][length - 1];
            } else {
                minLOD = defaultMinLOD;
                maxLOD = defaultMaxLOD;
            }
            this.updateLODInfo(minLOD, maxLOD);
            resetNewLoadedMeshes(minLOD, maxLOD);
            params.color = colorPalette[dataJSON.triangles[i][0][3]];
            params.texCoords = (length >= 10) ? [dataJSON.triangles[i][0].slice(4, 6), dataJSON.triangles[i][0].slice(6, 8), dataJSON.triangles[i][0].slice(8, 10)] : triangle.texCoords;
            params.normals = (dataJSON.triangles[i][1].length > 0) ?
                    ((dataJSON.triangles[i][1].length > 3) ?
                            [dataJSON.triangles[i][1].slice(0, 3), dataJSON.triangles[i][1].slice(3, 6), dataJSON.triangles[i][1].slice(6, 9)] :
                            [dataJSON.triangles[i][1]]) :
                    triangle.normals;
            params.groupIndices = (dataJSON.triangles[i].length >= 3) ?
                    ((dataJSON.triangles[i][2].length > 0) ? dataJSON.triangles[i][2] : triangle.groupIndices) :
                    null;
            params.withoutLines = true;
            triangle = null;
            for (j = minLOD; j <= maxLOD; j++) {
                if (!triangle) {
                    triangle = this.getMeshWithLOD(j).addTriangleWithParams(
                            dataJSON.triangles[i][0][0], // a
                            dataJSON.triangles[i][0][1], // b
                            dataJSON.triangles[i][0][2], // c
                            params);
                } else {
                    this.getMeshWithLOD(j).addTriangle(triangle, params.withoutLines);
                }
            }
        }
        application.log_DEBUG("Loaded " + nTriangles + " triangles.", 3);
        application.log_DEBUG("Model loaded: " + this._name + ". Details: " + this._minLOD + "-" + this._maxLOD, 2);
        str = "Number of triangles per LOD for " + this._name + ": ";
        for (i = this._minLOD; i <= this._maxLOD; i++) {
            str += " [" + i + "]: " + this.getMeshWithLOD(i).getNumTriangles();
        }
        application.log_DEBUG(str, 2);
        return true;
    };
    /**
     * Returns the scale factor of this model i.e. what is the meaning of 1 coordinate
     * unit in meters.
     * @returns {Number}
     */
    Model.prototype.getScale = function () {
        return this._scale;
    };
    /**
     * Calls the given value function by passing it all of the meshes one after the other, and returns the highest value it returns from
     * these calls. 
     * @param {Number} [lod] If given, the functon will be called only for the mesh with the given LOD
     * @param {Function} valueFunction
     */
    Model.prototype._getLargestValueOfMeshes = function (lod, valueFunction) {
        var result, current;
        if (lod !== undefined) {
            return valueFunction(this.getMeshWithLOD(lod));
        }
        for (lod = this._minLOD; lod <= this._maxLOD; lod++) {
            current = valueFunction(this.getMeshWithLOD(lod));
            if ((result === undefined) || (current > result)) {
                result = current;
            }
        }
        return result;
    };
    /**
     * Calls the given value function by passing it all of the meshes one after the other, and returns the lowest value it returns from
     * these calls. 
     * @param {Number} [lod] If given, the functon will be called only for the mesh with the given LOD
     * @param {Function} valueFunction
     */
    Model.prototype._getLowestValueOfMeshes = function (lod, valueFunction) {
        var result, current;
        if (lod !== undefined) {
            return valueFunction(this.getMeshWithLOD(lod));
        }
        for (lod = this._minLOD; lod <= this._maxLOD; lod++) {
            current = valueFunction(this.getMeshWithLOD(lod));
            if ((result === undefined) || (current < result)) {
                result = current;
            }
        }
        return result;
    };
    /**
     * Returns the size of the model, which is calculated as the double of the
     * farthest (X,Y or Z) vertex coordinate to be found in the model.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getSize = function (lod) {
        return this._getLargestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getSize() : 0;
        });
    };

    /**
     * Returns the greatest positive X vertex coordinate to be found in the 
     * model.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getMaxX = function (lod) {
        return this._getLargestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getMaxX() : 0;
        });
    };

    /**
     * Returns the greatest negative X vertex coordinate to be found in the 
     * model.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getMinX = function (lod) {
        return this._getLowestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getMinX() : 0;
        });
    };

    /**
     * Returns the greatest positive Y vertex coordinate to be found in the 
     * model.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getMaxY = function (lod) {
        return this._getLargestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getMaxY() : 0;
        });
    };

    /**
     * Returns the greatest negative Y vertex coordinate to be found in the 
     * model.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getMinY = function (lod) {
        return this._getLowestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getMinY() : 0;
        });
    };

    /**
     * Returns the greatest positive Z vertex coordinate to be found in the 
     * model.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getMaxZ = function (lod) {
        return this._getLargestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getMaxZ() : 0;
        });
    };

    /**
     * Returns the greatest negative Z vertex coordinate to be found in the 
     * model.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getMinZ = function (lod) {
        return this._getLowestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getMinZ() : 0;
        });
    };

    /**
     * Returns the width of the model, which is calculated as the difference
     * between the smallest and greatest X coordinates found among the vertices.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getWidth = function (lod) {
        return this._getLargestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getWidth() : 0;
        });
    };

    /**
     * Returns the height of the model, which is calculated as the difference
     * between the smallest and greatest Y coordinates found among the vertices.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getHeight = function (lod) {
        return this._getLargestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getHeight() : 0;
        });
    };

    /**
     * Returns the depth of the model, which is calculated as the difference
     * between the smallest and greatest Z coordinates found among the vertices.
     * @param {Number} [lod] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getDepth = function (lod) {
        return this._getLargestValueOfMeshes(lod, function (mesh) {
            return mesh ? mesh.getDepth() : 0;
        });
    };

    /**
     * Returns the width of the model in meters.
     * @param {Number} [lod=0] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getWidthInMeters = function (lod) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        return this.getWidth(lod) * this._scale;
    };

    /**
     * Returns the height of the model in meters.
     * @param {Number} [lod=0] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getHeightInMeters = function (lod) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        return this.getHeight(lod) * this._scale;
    };

    /**
     * Returns the depth of the model in meters.
     * @param {Number} [lod=0] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getDepthInMeters = function (lod) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        return this.getDepth(lod) * this._scale;
    };

    /**
     * Returns the number of lines this model contains.
     * @param {Number} [lod=0] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getNumLines = function (lod) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        return (lod >= 0) ? this.getMeshWithLOD(lod).getNumLines() : 0;
    };

    /**
     * Returns the number of completely opaque triangles this model contains.
     * @param {Number} [lod=0] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getNumOpaqueTriangles = function (lod) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        return this.getMeshWithLOD(lod).getNumOpaqueTriangles();
    };

    /**
     * Returns the number of transparent triangles this model contains.
     * @param {Number} [lod=0] The level of detail of the mesh to consider.
     * @returns {Number}
     */
    Model.prototype.getNumTransparentTriangles = function (lod) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        return this.getMeshWithLOD(lod).getNumTransparentTriangles();
    };

    /**
     * Returns the number of triangles this model contains.
     * @param {Number} [lod=0] The level of detail of the mesh to consider.
     * @param {Boolean} [transparent] Whether to count the transparent or the opaque triangles. If not given, both will be counted.
     * @returns {Number}
     */
    Model.prototype.getNumTriangles = function (lod, transparent) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        return (lod >= 0) ? this.getMeshWithLOD(lod).getNumTriangles(transparent) : 0;
    };

    /**
     * Adds this model to the passed ManagedGLContext in the specified drawing
     * mode (wireframe or solid), so that later the vertex buffers of the 
     * context can be filled with its data.
     * @param {ManagedGLContext} context The context to which the model should 
     * be added.
     * @param {Boolean} wireframe Whether to add the model for wireframe 
     * drawing.
     * Both modes can be added after each other with two calls of this 
     * functions.
     */
    Model.prototype.addToContext = function (context, wireframe) {
        this._minLOD = (this._minLOD !== this.LOD_NOT_SET) ? this._minLOD : 0;
        this._maxLOD = (this._maxLOD !== this.LOD_NOT_SET) ? this._maxLOD : 0;
        // get the already stored properties for easier access
        var props = this._contextProperties[context.getName()];
        // If the model hasn't been added to this context at all yet, add it with
        // the appropriate mode.
        if (!props) {
            application.log_DEBUG("Adding model (" + this._name + ") to context (" + (wireframe ? "wireframe" : "solid") + " mode)...", 2);
            props = new ModelContextProperties();
            props.wireframe = wireframe;
            props.solid = !wireframe;
            props.minLOD = this._minLOD;
            props.maxLOD = this._maxLOD;
            context.addModel(this);
            // If the model itself was added, check if it has been added with this
            // mode, and if not, the context needs to be reset in order to trigger
            // a new vertex buffer loading next time it is initialized, since new
            // data will need to be loaded to the buffers.
        } else {
            if (!props.wireframe && wireframe) {
                application.log_DEBUG("Adding model (" + this._name + ") to context in wireframe mode)...", 2);
                props.wireframe = true;
                context.resetReadyState();
            }
            if (!props.solid && !wireframe) {
                application.log_DEBUG("Adding model (" + this._name + ") to context in solid mode)...", 2);
                props.solid = true;
                context.resetReadyState();
            }
            if (props.minLOD > this._minLOD) {
                application.log_DEBUG("Adding model (" + this._name + ") to context with minimum LOD " + this._minLOD + "...", 2);
                props.minLOD = this._minLOD;
                context.resetReadyState();
            }
            if (props.maxLOD < this._maxLOD) {
                application.log_DEBUG("Adding model (" + this._name + ") to context with maximum LOD " + this._maxLOD + "...", 2);
                props.maxLOD = this._maxLOD;
                context.resetReadyState();
            }
        }
        // update the stored parameters
        this._contextProperties[context.getName()] = props;
    };

    /**
     * Clears all previous bindings to managed WebGL contexts. After this, the
     * model needs to be added again to contexts if it needs to be rendered in
     * them.
     */
    Model.prototype.clearContextBindings = function () {
        var contextName;
        for (contextName in this._contextProperties) {
            if (this._contextProperties.hasOwnProperty(contextName)) {
                delete this._contextProperties[contextName];
            }
        }
    };

    /**
     * Returns the data about this 3D model that is in a proper format to be 
     * loaded into GL vertex buffers.
     * @param {Boolean} wireframe Whether data for wireframe rendering should
     * be returned (false -> solid rendering)
     * @param {Number} startIndex The current size of the vertex buffers to
     * which the data from this model is to be added to, so that correct
     * indices will be calculated.
     * @param {Number} [lod=0] The LOD of the mesh to be added (only one mesh
     * may be added at a time)
     * @returns {Object}
     */
    Model.prototype.getBufferData = function (wireframe, startIndex, lod) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        return this.getMeshWithLOD(lod).getBufferData(wireframe, startIndex);
    };

    /**
     * Returns the size of the vertex buffer data (number of vertices) that this
     * model has for the specified context.
     * @param {ManagedGLContext} context
     * @returns {Number}
     */
    Model.prototype.getBufferSize = function (context) {
        var i,
                props = this._contextProperties[context.getName()],
                result = 0;
        for (i = props.minLOD; i <= props.maxLOD; i++) {
            result += this.getMeshWithLOD(i).getBufferSize(props.wireframe, props.solid);
        }
        return result;
    };

    /**
     * Loads the model's vertex data into the vertex buffer objects of the specified
     * context. Data for wireframe and solid rendering is added based on whether
     * the model has been previously added to the context in the respective mode.
     * @param {ManagedGLContext} context
     * @param {Number} startIndex The data will be added starting from this 
     * vertex index within the buffer objects.
     * @param {Number} [lod=0]
     * @returns {Number} The number of vertices for which data has been added.
     */
    Model.prototype.loadToVertexBuffers = function (context, startIndex, lod) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        var props = this._contextProperties[context.getName()];
        return this.getMeshWithLOD(lod).loadToVertexBuffers(context, startIndex, props.wireframe, props.solid);
    };

    /**
     * Renders the model within the passed context, with the specified rendering
     * mode (wireframe or solid).
     * @param {ManagedGLContext} context The context into which the model is to
     * be rendered. The model has to be added to this context previously in the
     * same rendering mode, and the context needs to be set up afterwards for
     * rendering.
     * @param {Boolean} wireframe Whether the model should be rendered in 
     * wireframe mode.
     * @param {Boolean} opaque Whether only the opaque parts of the model should be
     * rendered. False means only transparent parts, and undefined (omitted) means
     * the whole model. Only effective in solid rendering mode.
     * @param {Number} [lod=0]
     */
    Model.prototype.render = function (context, wireframe, opaque, lod) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        this.getMeshWithLOD(lod).render(context, wireframe, opaque);
    };
    /**
     * Similar to the regular render method, but this renders the given number of instances of the model using instancing.
     * @param {ManagedGLContext} context
     * @param {Boolean} wireframe
     * @param {Boolean} [opaque]
     * @param {Number} [lod=0]
     * @param {Number} instanceCount
     */
    Model.prototype.renderInstances = function (context, wireframe, opaque, lod, instanceCount) {
        lod = (lod !== undefined) ? lod : this._minLOD;
        this.getMeshWithLOD(lod).renderInstances(context, wireframe, opaque, instanceCount);
    };

    /**
     * Adds a new vertex to the currently edited mesh(es).
     * @param {Number[3]} position
     * @param {Number[2]} [texCoords]
     */
    Model.prototype.appendVertex = function (position, texCoords) {
        var i;
        if (this._editedMesh) {
            this._editedMesh.appendVertex(position, texCoords);
        } else {
            for (i = this._minEditedLOD; i <= this._maxEditedLOD; i++) {
                this.getMeshWithLOD(i).appendVertex(position, texCoords);
            }
        }
    };

    /**
     * Adds a new line to the currently edited mesh(es).
     * @param {Line} line
     */
    Model.prototype.addLine = function (line) {
        var i;
        if (this._editedMesh) {
            this._editedMesh.addLine(line);
        } else {
            for (i = this._minEditedLOD; i <= this._maxEditedLOD; i++) {
                this.getMeshWithLOD(i).addLine(line);
            }
        }
    };

    /**
     * Adds two triangles forming a quadrilateral between 4 vertices.
     * @param {Number} a The index of the first vertex of the quad.
     * @param {Number} b The index of the second vertex of the quad.
     * @param {Number} c The index of the third vertex of the quad.
     * @param {Number} d The index of the fourth vertex of the quad.
     * @param {Object} params The parameters of the quad in the same format as with
     * single triangles.
     * @see Model#addTriangle
     */
    Model.prototype.addQuad = function (a, b, c, d, params) {
        var i;
        if (this._editedMesh) {
            this._editedMesh.addQuad(a, b, c, d, params);
        } else {
            for (i = this._minEditedLOD; i <= this._maxEditedLOD; i++) {
                this.getMeshWithLOD(i).addQuad(a, b, c, d, params);
            }
        }
    };

    /**
     * Adds a cuboid geometry to the object. (both vertices and faces)
     * @param {Number} x The X coordinate of the center of the cuboid.
     * @param {Number} y The Y coordinate of the center of the cuboid.
     * @param {Number} z The Z coordinate of the center of the cuboid.
     * @param {Number} width The width (X dimension) of the cuboid.
     * @param {Number} height The height (Y dimension) of the cuboid.
     * @param {Number} depth The depth (Z dimension) of the cuboid.
     * @param {Number[4]} color The color of the faces of the cuboid 
     * ([red,green,blue,alpha])
     * @param {Number[4][2]} textureCoordinates The texture coordinates for the 
     * faces of the cuboid (the two coordinates for each of the 4 vertices of one
     * face.
     * @param {Boolean} cullFace Whether the faces facing the inside of the cuboid
     * should be culled (omitted)
     */
    Model.prototype.addCuboid = function (x, y, z, width, height, depth, color, textureCoordinates, cullFace) {
        var i;
        if (this._editedMesh) {
            this._editedMesh.addCuboid(x, y, z, width, height, depth, color, textureCoordinates, cullFace);
        } else {
            for (i = this._minEditedLOD; i <= this._maxEditedLOD; i++) {
                this.getMeshWithLOD(i).addCuboid(x, y, z, width, height, depth, color, textureCoordinates, cullFace);
            }
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        VertexAttributeRole: VertexAttributeRole,
        resetDebugStats: resetDebugStats,
        getDebugStats: getDebugStats,
        Model: Model,
        /**
         * Sets up and returns a simple model that is suitable to be used for
         * rendering Full Viewport Quads. (FVQ)
         * @param {String} [name] The name of the model to be created.
         * @returns {Model}
         */
        fvqModel: function (name) {
            var result = new Model();
            if (name) {
                result.setName(name);
            }

            result.appendVertex([-1, -1, 0]);
            result.appendVertex([1, -1, 0]);
            result.appendVertex([1, 1, 0]);
            result.appendVertex([-1, 1, 0]);

            result.addQuad(0, 1, 2, 3);

            return result;
        },
        /**
         * Sets up and returns a simple model that contains a two sided XY square.
         * @param {String} [name] The name of the model to be created.
         * @param {Number[2][2]} [textureCoordinates] The texture coordinates to use - top-left and bottom-right, in (0;0) - (1;1) space
         * @returns {Model}
         */
        squareModel: function (name, textureCoordinates) {
            var result = new Model(), tc;
            if (name) {
                result.setName(name);
            }
            tc = textureCoordinates || DEFAULT_SQUARE_TEX_COORDINATES;

            result.appendVertex([-1, -1, 0]);
            result.appendVertex([1, -1, 0]);
            result.appendVertex([1, 1, 0]);
            result.appendVertex([-1, 1, 0]);

            result.addQuad(0, 1, 2, 3, {texCoords: [[tc[0][0], tc[1][1]], [tc[1][0], tc[1][1]], [tc[1][0], tc[0][1]], [tc[0][0], tc[0][1]]]});

            return result;
        },
        /**
         * Sets up and returns a simple model that is suitable for rendering billboards that turn around one axis to face the camera. The 
         * model contains one square to serve as the turning side view (with texture coordinates corresponding to the upper half of the 
         * texture) and a set of intersecting squares that are perpendicular to the first one (with texture coordinates corresponding to the 
         * lower half of the texture), to serve as the front/back view(s) so that the billboard does not look flat at sharp angles.
         * @param {String} [name] The name of the model to be created.
         * @param {Number[]} [intersections] A set of numbers between -1 and 1 representing the points where the squares serving as the 
         * front view should be created along the side view square.
         * @param {Number} width On X and Z axes, the model will be "trimmed" using this ratio (should be between 0 and 1), by multiplying 
         * both its vertex and texture coordinates.
         * @returns {Model}
         */
        turningBillboardModel: function (name, intersections, width) {
            var i,
                    tLeft = 0.5 - 0.5 * width, tRight = 0.5 + 0.5 * width,
                    tTop = 0.75 - 0.25 * width, tBottom = 0.75 + 0.25 * width,
                    result = new Model();
            if (name) {
                result.setName(name);
            }

            result.appendVertex([-width, -1, 0]);
            result.appendVertex([width, -1, 0]);
            result.appendVertex([width, 1, 0]);
            result.appendVertex([-width, 1, 0]);

            result.addQuad(0, 1, 2, 3, {texCoords: [[tLeft, 0.5], [tRight, 0.5], [tRight, 0.0], [tLeft, 0.0]]});

            if (intersections) {
                for (i = 0; i < intersections.length; i++) {
                    result.appendVertex([width, intersections[i], -width]);
                    result.appendVertex([-width, intersections[i], -width]);
                    result.appendVertex([-width, intersections[i], width]);
                    result.appendVertex([width, intersections[i], width]);

                    result.addQuad(((i + 1) * 4), ((i + 1) * 4) + 1, ((i + 1) * 4) + 2, ((i + 1) * 4) + 3,
                            {
                                texCoords:
                                        [[tLeft, tBottom], [tRight, tBottom], [tRight, tTop], [tLeft, tTop]]
                            });
                    result.addQuad(((i + 1) * 4) + 3, ((i + 1) * 4) + 2, ((i + 1) * 4) + 1, ((i + 1) * 4),
                            {
                                texCoords:
                                        [[tLeft, tBottom], [tRight, tBottom], [tRight, tTop], [tLeft, tTop]]
                            });
                }
            }

            return result;
        },
        /**
         * Sets up and returns a simple model that contains a cuboid (XYZ-box)  
         * with the given properties.
         * @param {String} [name] The name of the model to be created.
         * @param {Number} width Size of the box along the X axis.
         * @param {Number} height Size of the box along the Y axis.
         * @param {Number} depth Size of the box along the Z axis.
         * @param {Number[4]} color A vector containing the RGBA components of the 
         * desired box color.
         * @returns {Model}
         */
        cuboidModel: function (name, width, height, depth, color) {
            var result = new Model();
            if (name) {
                result.setName(name);
            }
            result.addCuboid(0, 0, 0, width, height, depth, color, [[0, 1], [1, 1], [1, 0], [0, 0]], false);
            return result;
        },
        /**
         * Sets up and returns a simple model that contains a two vertices, the
         * first of which is in the origo, connected by a line.
         * @param {String} [name] The name of the model to be created.
         * @param {Number[3]} vector The vector pointing from the origo towards 
         * the second vertex.
         * @param {Number[4]} color The RGB components of the color to use for 
         * the line.
         * @returns {Model}
         */
        lineModel: function (name, vector, color) {
            var result = new Model();
            if (name) {
                result.setName(name);
            }
            result.appendVertex([0.0, 0.0, 0.0]);
            result.appendVertex(vector);
            result.addLine(new Line(0, 1, color, vector));
            return result;
        }
    };
});