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
uniform sampler2D u_shadowMaps[4];
uniform vec3 u_eyePos;
uniform Light u_lights[12];
uniform int u_numLights;
uniform bool u_shadows;
uniform float u_shadowMapRange;
	
varying vec3 v_position;
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;
varying float v_luminosityFactor;

varying vec4 v_worldPos;

	
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
    bool lighted;

    for(int i=0;i<12;i++) {
        if(i<u_numLights) {
            diffuseFactor = max(0.0,dot(+u_lights[i].direction,normal));

            lighted = false;

            if(diffuseFactor>0.0) {
                lighted = true;
                if(u_shadows) {
                    shadowMapPosition = u_lights[i].matrix * u_modelMatrix * vec4(v_position,1.0);
                    shadowMapPosition.xyz /= 2.0*u_shadowMapRange;
                    shadowMapPosition.xyz += vec3(0.5,0.5,0.5);

                    if(shadowMapPosition.z < texture2D(u_shadowMaps[i],shadowMapPosition.xy).r-1.0/u_shadowMapRange) {
                        lighted = false;
                    }
                }

                if(lighted) {
                    specularFactor = v_shininess>0.0?pow(max(dot(reflDir,u_lights[i].direction),0.0), v_shininess):0.0;

                    gl_FragColor.rgb += 
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
