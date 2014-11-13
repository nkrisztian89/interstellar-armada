// shader used for spaceships

precision mediump float;
	
struct Light
    {
        vec3 color;
        vec3 direction;
        mat4 matrix;
    };

uniform mat4 u_modelMatrix;

uniform sampler2D u_colorTexture;
uniform sampler2D u_specularTexture;
uniform sampler2D u_luminosityTexture;
uniform sampler2D u_shadowMaps[12];
uniform vec3 u_eyePos;
uniform Light u_lights[2];
uniform int u_numLights;
uniform bool u_shadows;
uniform float u_shadowMapRanges[6];
uniform int u_numRanges;
uniform float u_shadowMapDepthRatio;
	
varying vec3 v_position;
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;
varying float v_luminosityFactor;

varying vec4 v_worldPos;

varying vec4 v_index;
	
void main() {
    // interpolated normals can have different then unit length
    vec3 normal = normalize(v_normal);

    vec3 viewDir = normalize(v_worldPos.xyz - u_eyePos);
    vec3 reflDir = reflect (viewDir, normal);

    vec4 texCol = texture2D(u_colorTexture, v_texCoord);
    vec4 texSpec = texture2D(u_specularTexture, v_texCoord);
    vec4 texLum = texture2D(u_luminosityTexture, v_texCoord);

    gl_FragColor.rgb = 
        // add normal texture lighted by luminosity factor
        v_luminosity * v_color.rgb * texCol.rgb
        // add the luminosity texture
        + v_luminosityFactor * texLum.rgb;

    float diffuseFactor;
    float specularFactor;
    vec4 shadowMapPosition;
    float lighted;
    vec4 shadowMapTexel;
    float indexDifference;

    for (int i=0; i<2; i++) {
        if (i < u_numLights) {
            diffuseFactor = max(0.0,dot(+u_lights[i].direction,normal));

            lighted = 0.0;

            if (diffuseFactor > 0.0) {
                lighted = 1.0;
                if (u_shadows) {
                    shadowMapPosition = u_lights[i].matrix * u_modelMatrix * vec4(v_position,1.0);
                    for (int range = 0; range < 6; range++) {
                        if (range < u_numRanges) {
                            if(length(shadowMapPosition.xy)<u_shadowMapRanges[range]) {
                                vec3 posInRange = shadowMapPosition.xyz / u_shadowMapRanges[range];
                                float depth = 0.5+shadowMapPosition.z/(2.0*u_shadowMapRanges[range]*u_shadowMapDepthRatio);
                                float shade = (range == (u_numRanges-1)) ? 1.0 - clamp((length(posInRange.xyz)-0.8)*5.0,0.0,1.0) : 1.0;
                                posInRange.xyz += vec3(1.0,1.0,1.0);
                                posInRange.xyz /= 2.0;
                                if(posInRange.xy == clamp(posInRange.xy,0.0,1.0)) {
                                    shadowMapTexel = texture2D(u_shadowMaps[i*6+range],posInRange.xy);
                                    float texelDepth = shadowMapTexel.w + (shadowMapTexel.z / 256.0);
                                    if(texelDepth>0.0) {
                                        indexDifference = length(v_index.xy - shadowMapTexel.rg);
                                        if((texelDepth>depth+0.5/255.0) && (indexDifference>0.5/255.0)) {
                                            float transition = clamp((texelDepth-(depth+0.5/255.0))*u_shadowMapRanges[range]*u_shadowMapDepthRatio*5.0,0.0,1.0);
                                            shade *= transition;
                                            lighted = max(0.0,lighted - shade);
                                        }
                                        break;
                                    }
                                }
                            }
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
    // the alpha component from the attribute color and texture
    gl_FragColor.a = v_color.a*texCol.a; 
}
