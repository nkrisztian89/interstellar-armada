    // handling dynamic point-like light sources
    vec3 direction;
    float intensity;
    float dist;
    for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
        if (i < u_numPointLights) {
            direction = u_pointLights[i].position - v_worldPos.xyz;
            dist = length(direction);
            direction = normalize(direction);
            float diffuseFactor = max(0.0, dot(direction, normal));
            intensity = u_pointLights[i].color.a;
            gl_FragColor.rgb += min(u_pointLights[i].color.rgb * diffuseFactor  * intensity / (dist * dist), 1.0) * diffuseColor.rgb;
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
            float diffuseFactor = max(0.0, dot(direction, normal));
            intensity = u_spotLights[i].color.a;
            cosine = dot(direction, -u_spotLights[i].spot.xyz);
            cutoffFactor = 1.0;
            if (cosine >= u_spotLights[i].spot.a) {
                if (u_spotLights[i].position.a > 0.0) {
                    cutoffFactor = clamp((cosine - u_spotLights[i].spot.a) / (u_spotLights[i].position.a - u_spotLights[i].spot.a), 0.0, 1.0);
                }
                gl_FragColor.rgb += min(u_spotLights[i].color.rgb * diffuseFactor  * intensity / (dist * dist), 1.0) * cutoffFactor * diffuseColor.rgb;
            }
        }
    }