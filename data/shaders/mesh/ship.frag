// shader used for spaceships: phong shading + luminosity mapping + shadow mapping

precision mediump float;

#define MAX_LIGHTS 2
#define MAX_POINT_LIGHTS 128
#define MAX_SPOT_LIGHTS 7

#define MAX_SHADOW_MAP_RANGES 6
#define MAX_SHADOW_MAPS 12
	
struct Light
    {
        vec3 color;
        vec3 direction;
        mat4 matrix;
        vec3 translationVector;
    };

struct PointLight
    {
        vec4 color; // RGB color and intensity
        vec3 position; // position
    };

struct SpotLight
    {
        vec4 color; // RGB color and intensity
        vec4 spot; // spot direction XYZ and cutoff angle cosine
        vec4 position; // position and full intensity angle cosine
    };

// phong shading
uniform sampler2D u_diffuseTexture;
uniform sampler2D u_specularTexture;
uniform vec3 u_eyePos;
uniform Light u_lights[MAX_LIGHTS];
uniform int u_numLights;
uniform PointLight u_pointLights[MAX_POINT_LIGHTS];
uniform int u_numPointLights;
uniform SpotLight u_spotLights[MAX_SPOT_LIGHTS];
uniform int u_numSpotLights;

// luminosity mapping
uniform sampler2D u_emissiveTexture;

// shadow mapping
uniform mat4 u_modelMatrix;
uniform sampler2D u_shadowMaps[MAX_SHADOW_MAPS];
uniform bool u_shadows;
uniform float u_shadowMapRanges[MAX_SHADOW_MAP_RANGES];
uniform int u_numRanges;
uniform float u_shadowMapDepthRatio;
	
varying vec3 v_position;
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;
varying float v_luminosityFactor;
varying vec4 v_index;

varying vec4 v_worldPos;

varying vec4 v_shadowMapPosition[MAX_LIGHTS];
	
void main() {
    // interpolated normals can have different then unit length
    vec3 normal = normalize(v_normal);

    vec3 viewDir = normalize(v_worldPos.xyz - u_eyePos);
    vec3 reflDir = reflect (viewDir, normal);

    vec4 texCol = texture2D(u_diffuseTexture, v_texCoord);
    vec4 texSpec = texture2D(u_specularTexture, v_texCoord);
    vec4 texLum = texture2D(u_emissiveTexture, v_texCoord);

    gl_FragColor.rgb = 
        // add normal texture lighted by luminosity factor
        v_luminosity * v_color.rgb * texCol.rgb
        // add the luminosity texture
        + v_luminosityFactor * texLum.rgb;

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
    for (int i = 0; i < MAX_LIGHTS; i++) {
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
                    for (int j = 0; j < MAX_SHADOW_MAP_RANGES; j++) {
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
                                    //shadowMapTexel = texture2D(u_shadowMaps[i * MAX_SHADOW_MAP_RANGES + j], shMapTexCoords);
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

                    gl_FragColor.rgb += lighted *
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
    // handling dynamic point-like light sources
    vec3 direction;
    float intensity;
    float specDist;
    for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
        if (i < u_numPointLights) {
            direction = u_pointLights[i].position - v_worldPos.xyz;
            dist = length(direction);
            direction = normalize(direction);
            specDist = dist + length(v_worldPos.xyz - u_eyePos);
            diffuseFactor = max(0.0, dot(direction, normal));
            specularFactor = v_shininess > 0.0 ? pow(max(dot(reflDir, direction), 0.0), v_shininess) : 0.0;
            intensity = u_pointLights[i].color.a;
            gl_FragColor.rgb += clamp(u_pointLights[i].color.rgb * diffuseFactor  * intensity / (dist * dist), 0.0, 1.0) * v_color.rgb * texCol.rgb
                              + clamp(u_pointLights[i].color.rgb * specularFactor * intensity / (specDist * specDist), 0.0, 1.0) * texSpec.rgb;
        }
    }
    // handling spotlights
    float cutoffFactor;
    float cosine;
    for (int i = 0; i < MAX_SPOT_LIGHTS; i++) {
        if (i < u_numSpotLights) {
            direction = u_spotLights[i].position.xyz - v_worldPos.xyz;
            dist = length(direction);
            direction = normalize(direction);
            specDist = dist + length(v_worldPos.xyz - u_eyePos);
            diffuseFactor = max(0.0, dot(direction, normal));
            specularFactor = v_shininess > 0.0 ? pow(max(dot(reflDir, direction), 0.0), v_shininess) : 0.0;
            intensity = u_spotLights[i].color.a;
            cosine = dot(direction, -u_spotLights[i].spot.xyz);
            cutoffFactor = 1.0;
            if (cosine >= u_spotLights[i].spot.a) {
                if (u_spotLights[i].position.a > 0.0) {
                    cutoffFactor = clamp((cosine - u_spotLights[i].spot.a) / (u_spotLights[i].position.a - u_spotLights[i].spot.a), 0.0, 1.0);
                }
                gl_FragColor.rgb += clamp(u_spotLights[i].color.rgb * diffuseFactor  * intensity / (dist * dist), 0.0, 1.0) * cutoffFactor * v_color.rgb * texCol.rgb
                                  + clamp(u_spotLights[i].color.rgb * specularFactor * intensity / (specDist * specDist), 0.0, 1.0) * cutoffFactor * texSpec.rgb;
            }
        }
    }
    // the alpha component from the attribute color and texture
    gl_FragColor.a = v_color.a*texCol.a; 
}
