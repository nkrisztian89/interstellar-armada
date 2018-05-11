/*jslint white: true*/
/*global module*/
module.exports = function (grunt) {
    "use strict";
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        requirejs: {
            compile: {
                options: {
                    baseUrl: "js",
                    name: "main",
                    optimize: "uglify2",
                    uglify2: {
                        mangle: {
                            keep_fnames: true // we rely on Function.prototype.name at some points (e.g. common Pools)
                        }
                    },
                    out: "js/main-optimized.js",
                    preserveLicenseComments: false
                }
            }
        },
        rawClean: {
            dev: ["js/main-optimized.js", "css/*.map", "css/general.css"]
        },
        eslint: {
            options: {
                configFile: ".eslintrc.js"
            },
            target: ["js/"]
        },
        sass: {
            dev: {
                options: {
                    style: "expanded"
                },
                files: {
                    "css/general.css": 'scss/general.scss'
                }
            },
            dist: {
                options: {
                    sourcemap: "none",
                    style: "compressed"
                },
                files: {
                    "css/general.css": 'scss/general.scss'
                }
            }
        },
        replace: {
            dist: {
                options: {
                    patterns: [
                        {
                            match: 'main.js',
                            replacement: 'main-optimized.js'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['index.html'], dest: './'}
                ]
            },
            preOptimize: {
                options: {
                    patterns: [
                        {
                            match: '_matrixCount++;',
                            replacement: '//_matrixCount++;'
                        }, {
                            match: 'application.log_DEBUG',
                            replacement: '//application.log_DEBUG'
                        }, {
                            match: '_DEBUG_STATS.',
                            replacement: '//_DEBUG_STATS.'
                        }, {
                            match: 'egomModel.resetDebugStats();',
                            replacement: '//egomModel.resetDebugStats();'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['js/utils/matrices.js'], dest: 'js/utils/'},
                    {expand: true, flatten: true, src: ['js/modules/egom-model.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/scene/scene-graph.js'], dest: 'js/modules/scene/'},
                    {expand: true, flatten: true, src: ['js/modules/managed-gl.js'], dest: 'js/modules/'}
                ]
            },
            // replacing some widely and frequently used one-line getter calls with the direct access of their respective properties to
            // avoid the overhead of calling the getter functions
            optimize: {
                options: {
                    patterns: [
                        {
                            match: '.getPositionMatrix()',
                            replacement: '._positionMatrix'
                        }, {
                            match: '.getOrientationMatrix()',
                            replacement: '._orientationMatrix'
                        }, {
                            match: '.getScalingMatrix()',
                            replacement: '._scalingMatrix'
                        }, {
                            match: '.getParent()',
                            replacement: '._parent'
                        }, {
                            match: '.getScene()',
                            replacement: '._scene'
                        }, {
                            match: '.getRenderableObject()',
                            replacement: '._renderableObject'
                        }, {
                            match: '.getSubnodes()',
                            replacement: '._subnodes'
                        }, {
                            match: '.getMinimumCountForInstancing()',
                            replacement: '._minimumCountForInstancing'
                        }, {
                            match: '.getRootNode()',
                            replacement: '._rootNode'
                        }, {
                            match: '.getCamera()',
                            replacement: '._camera'
                        }, {
                            match: '.getLODContext()',
                            replacement: '._lodContext'
                        }, {
                            match: '.getStates()',
                            replacement: '._states'
                        }, {
                            match: '.getDuration()',
                            replacement: '._duration'
                        }, {
                            match: '.getVisualModel()',
                            replacement: '._visualModel'
                        }, {
                            match: '.getPhysicalModel()',
                            replacement: '._physicalModel'
                        }, {
                            match: '.childrenAlwaysInside()',
                            replacement: '._childrenAlwaysInside'
                        }, {
                            match: '.shouldIgnoreTransform()',
                            replacement: '._ignoreTransform'
                        }, {
                            match: 'setFileCacheBypassEnabled(!0)',
                            replacement: 'setFileCacheBypassEnabled(0)'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['js/main-optimized.js'], dest: 'js/'}
                ]
            },
            postOptimize: {
                options: {
                    patterns: [
                        {
                            match: '//_matrixCount++;',
                            replacement: '_matrixCount++;'
                        }, {
                            match: '//application.log_DEBUG',
                            replacement: 'application.log_DEBUG'
                        }, {
                            match: '//_DEBUG_STATS.',
                            replacement: '_DEBUG_STATS.'
                        }, {
                            match: '//egomModel.resetDebugStats();',
                            replacement: 'egomModel.resetDebugStats();'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['js/utils/matrices.js'], dest: 'js/utils/'},
                    {expand: true, flatten: true, src: ['js/modules/egom-model.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/scene/scene-graph.js'], dest: 'js/modules/scene/'},
                    {expand: true, flatten: true, src: ['js/modules/managed-gl.js'], dest: 'js/modules/'}
                ]
            },
            dev: {
                options: {
                    patterns: [
                        {
                            match: 'main-optimized.js',
                            replacement: 'main.js'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['index.html'], dest: './'}
                ]
            }
        }
    });
    // Plugins
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-replace');
    grunt.loadNpmTasks('grunt-eslint');
    // Tasks
    grunt.registerTask('default', ['build']);
    grunt.registerTask('build', ['sass:dist', 'replace:preOptimize', 'requirejs', 'replace:dist', 'replace:optimize', 'replace:postOptimize']);
    grunt.renameTask('clean', 'rawClean');
    grunt.registerTask('clean', ['rawClean:dev', 'replace:dev']);
    grunt.registerTask('lint', ['eslint']);
    grunt.registerTask('dev-build', ['sass:dev']);
    grunt.registerTask('css-build', ['sass:dist']);
};