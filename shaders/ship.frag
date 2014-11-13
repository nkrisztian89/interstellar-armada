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
uniform Light u_lights[3];
uniform int u_numLights;
uniform bool u_shadows;
uniform float u_shadowMapRanges[4];
uniform int u_numRanges;
	
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

    for (int i=0; i<3; i++) {
        if (i < u_numLights) {
            diffuseFactor = max(0.0,dot(+u_lights[i].direction,normal));

            lighted = 0.0;

            if (diffuseFactor > 0.0) {
                lighted = 1.0;
                if (u_shadows) {
                    shadowMapPosition = u_lights[i].matrix * u_modelMatrix * vec4(v_position,1.0);
                    for (int range = 0; range < 4; range++) {
                        if (range < u_numRanges) {
                            if(length(shadowMapPosition.xyz)<u_shadowMapRanges[range]) {
                                shadowMapPosition.xyz /= u_shadowMapRanges[range];
                                float dist = clamp((length(shadowMapPosition.xyz)-0.8)*5.0,0.0,1.0);
                                shadowMapPosition.xyz += vec3(1.0,1.0,1.0);
                                shadowMapPosition.xyz /= 2.0;
                                shadowMapPosition.xyz = clamp(shadowMapPosition.xyz,0.0,1.0);

                                shadowMapTexel = texture2D(u_shadowMaps[i*4+range],shadowMapPosition.xy);

                                if((shadowMapTexel.w>shadowMapPosition.z+0.5/255.0) && (length(v_index.xyz-shadowMapTexel.rgb)>0.5/255.0)) {
                                    lighted = min(lighted,(range == (u_numRanges-1)) ? dist : 0.0);
                                }
                                //break;
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
