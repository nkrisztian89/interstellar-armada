// phong, shadow mapping + reveal functionality

precision mediump float;
precision mediump int;

struct Light
    {
        vec3 color;
        vec3 direction;
        mat4 matrix;
        vec3 translationVector;
    };
	
// phong shading
uniform sampler2D u_diffuseTexture;
uniform sampler2D u_specularTexture;
uniform vec3 u_eyePos;
uniform Light u_lights[2];
uniform int u_numLights;

// shadow mapping
uniform mat4 u_modelMatrix;
uniform sampler2D u_shadowMaps[12];
uniform bool u_shadows;
uniform float u_shadowMapRanges[6];
uniform int u_numRanges;
uniform float u_shadowMapDepthRatio;

// reveal functionality
uniform float u_revealStart;            // the Y coordinate in model space from where the fragments are revealed
uniform bool u_revealFront;             // whether the front part (larger Y coordinates) of model is the one revealed
uniform float u_revealTransitionLength; // a gradient transition from u_revealColor will be added for this length after u_revealStart
uniform vec4 u_revealColor;

varying vec3 v_position;
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;
varying vec4 v_index;

// the coordinates of this fragment in world space
varying vec4 v_worldPos;
// the coordinates of this fragment in model space
varying vec4 v_modelPos;

varying vec4 v_shadowMapPosition[2];
	
void main() {
    // discard fragments that are not revealed yet
    if ((u_revealFront==true) && (v_modelPos.y<=u_revealStart)) {
        discard;
    } else
    if ((u_revealFront==false) && (v_modelPos.y>=u_revealStart)) {
        discard;
    // calculate the color of the revealed fragments
    } else {
        // interpolated normals can have different then unit length
        vec3 normal = normalize(v_normal);

        vec3 viewDir = normalize(v_worldPos.xyz - u_eyePos);
        vec3 reflDir = reflect (viewDir, normal);

        vec4 texCol = texture2D(u_diffuseTexture, v_texCoord);
        vec4 texSpec = texture2D(u_specularTexture, v_texCoord);

        vec4 color;
        color.rgb = v_luminosity * v_color.rgb * texCol.rgb;

        float diffuseFactor;
        float specularFactor;

        float lighted;
        vec4 shadowMapTexel;
        float indexDifference;
        bool covered;
        vec3 shadowMapPosition;
        float dist;

        // going through each static, directional light source
        // start and end indices need to be constant
        for (int i = 0; i < 2; i++) {
            // only go through actual light sources
            if (i < u_numLights) {
                // how much is the fragment lighted based on angle
                diffuseFactor = max(0.0, dot(+u_lights[i].direction, normal));
                // how much is the fragment lighted based on shadows
                lighted = 0.0;
                // any calculations only need to be done if the fragment gets lit somewhat in the first place
                if (diffuseFactor > 0.0) {
                    // start from not being obscured
                    lighted = 1.0;
                    // shadow map calculations only occur if we turned them on
                    if (u_shadows) {
                        // At each step, we only need to check for objects obscuring the current fragment
                        // that lie outside of the scope of the previous check.
                        // minimum depth of obscuring objects to check that are above the previously checked area
                        float minDepthAbove = 0.0; 
                        // maximum depth of obscuring objects to check that are below the previously checked area
                        float maxDepthBelow = 1.0;
                        // whether the projection of this fragment to the shadow map planes has already
                        // fallen into the covered area
                        covered = false;
                        // going through each shadow map (start and end indices need to be constant)
                        for (int j = 0; j < 6; j++) {
                            // only go through existing shadow maps
                            if (j < u_numRanges) {
                                // the range of the current shadow map (length of the area covered from center
                                // to the sides of the map in world coordinates)
                                float range = u_shadowMapRanges[j];
                                // the coordinates in shadow mapping space translated to have the current map center in the origo
                                shadowMapPosition = v_shadowMapPosition[i].xyz + (u_lights[i].translationVector * range);
                                // save the distance of the projection of current fragment 
                                // on the plane of the shadow maps from the center (in world coordinates)
                                dist = length(shadowMapPosition.xy);
                                // only check if the current fragment is (could be) covered by the current shadow map
                                if (dist < range) {
                                    // calculate texture coordinates on the current shadow map
                                    vec2 shMapTexCoords = shadowMapPosition.xy / range;
                                    float depth = shadowMapPosition.z / (range * u_shadowMapDepthRatio);
                                    // the factor for how much the fragment needs to be shaded by the shadows
                                    // for the largest shadow map, add a fade out factor towards the end of the range
                                    float shade = (j == (u_numRanges - 1)) ? 1.0 - clamp((length(vec3(shMapTexCoords.xy,depth)) - 0.8) * 5.0, 0.0, 1.0) : 1.0;
                                    // convert from -1.0;1.0 range to 0.0;1.0
                                    shMapTexCoords = vec2(0.5, 0.5) + shMapTexCoords / 2.0;
                                    depth = 0.5 + depth / 2.0;
                                    // only check the texture if we have valid coordinates for it
                                    if (shMapTexCoords == clamp(shMapTexCoords, 0.0, 1.0)) {
                                        // read the value of the texel from the shadow map
                                        // indexing samplers with loop variables is not supported by specification
                                        //shadowMapTexel = texture2D(u_shadowMaps[i * 6 + j], shMapTexCoords);
                                        int shMapIndex = i * u_numRanges + j;
                                        if (shMapIndex == 0) {
                                            shadowMapTexel = texture2D(u_shadowMaps[0], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 1) {
                                            shadowMapTexel = texture2D(u_shadowMaps[1], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 2) {
                                            shadowMapTexel = texture2D(u_shadowMaps[2], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 3) {
                                            shadowMapTexel = texture2D(u_shadowMaps[3], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 4) {
                                            shadowMapTexel = texture2D(u_shadowMaps[4], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 5) {
                                            shadowMapTexel = texture2D(u_shadowMaps[5], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 6) {
                                            shadowMapTexel = texture2D(u_shadowMaps[6], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 7) {
                                            shadowMapTexel = texture2D(u_shadowMaps[7], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 8) {
                                            shadowMapTexel = texture2D(u_shadowMaps[8], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 9) {
                                            shadowMapTexel = texture2D(u_shadowMaps[9], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 10) {
                                            shadowMapTexel = texture2D(u_shadowMaps[10], shMapTexCoords);
                                        } else 
                                        if (shMapIndex == 11) {
                                            shadowMapTexel = texture2D(u_shadowMaps[11], shMapTexCoords);
                                        }
                                        // the depth value is stored in the second two components of the texel
                                        float texelDepth = shadowMapTexel.w + (shadowMapTexel.z / 256.0);
                                        float absDepth = ((texelDepth - 0.5) * 2.0 * range * u_shadowMapDepthRatio) - shadowMapPosition.z;
                                        // depth check is performed with a tolerance for small errors
                                        float errorTolerance = 0.55 / 255.0;
                                        float absErrorTolerance = 1.0 / 255.0 * range * u_shadowMapDepthRatio;
                                        // check if there is depth content on the texel, which is in a range not checked before
                                        // (by depth or by coordinates)
                                        if((texelDepth > 0.0) && ((absDepth >= minDepthAbove - absErrorTolerance) || (absDepth <= maxDepthBelow + absErrorTolerance) || (!covered))) {
                                            // the triangle index value is stored in the first two components of the texel
                                            indexDifference = length(v_index.xy - shadowMapTexel.rg);
                                            // check if the fragment is obscured by a triangle with a different index
                                            if((texelDepth > depth + errorTolerance) && (indexDifference > 0.5 / 255.0)) {
                                                // for very small shadows (that would appear very pixelated), add a fade out factor
                                                float transition = clamp((texelDepth - (depth + errorTolerance)) * range * u_shadowMapDepthRatio * 5.0, 0.0, 1.0);
                                                shade *= transition;
                                                lighted = max(0.0, lighted - shade);
                                                if (lighted == 0.0) {
                                                    break;
                                                }
                                            }
                                        }
                                        // save the state that the XY position of this fragment has already been inside the
                                        // area covered by a shadow map - but only after the previous state has been checked
                                        covered = true;
                                    }
                                }
                                // set the variables to exclude the already checked depth region in the next step
                                minDepthAbove = -shadowMapPosition.z + (range * u_shadowMapDepthRatio);
                                maxDepthBelow = -shadowMapPosition.z - (range * u_shadowMapDepthRatio);
                            }
                        }
                    }

                    if (lighted > 0.0) {
                        specularFactor = v_shininess>0.0?pow(max(dot(reflDir,u_lights[i].direction),0.0), v_shininess):0.0;

                        color.rgb += lighted *
                            vec3(
                                // the RGB components
                                    clamp(
                                    // diffuse light reflected for different light sources
                                    u_lights[i].color*diffuseFactor
                                    // clamp each component
                                    ,0.0,1.0)
                                    // modulate with the colors from the vertices and the texture
                                    // the above components cannot make the surface lighter then
                                    // the modulated diffuse texture
                                    * v_color.rgb * texCol.rgb
                                    // add specular lighting, this can make the surface "overlighted"
                                    + specularFactor * u_lights[i].color * texSpec.rgb
                            );
                    }
                }
            }
        }
        // the alpha component from the attribute color and texture
        color.a = v_color.a*texCol.a; 

        // add a u_revealTransitionLength long transition from white to the calculated color from the start of reveal
        if ((u_revealFront==true) && (v_modelPos.y<=u_revealStart+u_revealTransitionLength)) {
            float factor = (v_modelPos.y-u_revealStart)/u_revealTransitionLength;
            color = color * factor + u_revealColor * (1.0-factor);
        } else
        if ((u_revealFront==false) && (v_modelPos.y>=u_revealStart-u_revealTransitionLength)) {
            float factor = (u_revealStart-v_modelPos.y)/u_revealTransitionLength;
            color = color * factor + u_revealColor * (1.0-factor);
        }

        gl_FragColor = color;
    }
}