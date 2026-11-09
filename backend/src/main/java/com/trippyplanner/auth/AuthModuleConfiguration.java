package com.trippyplanner.auth;

import org.springframework.context.annotation.Configuration;
import org.springframework.modulith.ApplicationModule;

/**
 * Binds the auth module to Spring Modulith.
 *
 * <p>Under Spring Modulith's convention the module's <em>public surface is its root package</em>
 * (there is no per-subpackage public-API marker in 2.x, so the former {@code auth.api} subpackage
 * was flattened into the module root — {@code CurrentUser} is now the one type other modules may
 * reach). auth may use the {@code common} module's {@code TokenGenerator} and the generated
 * {@code model}/{@code api} OpenAPI contract; it reaches no other domain module.
 */
@ApplicationModule(allowedDependencies = {"common", "model", "api"})
@Configuration(proxyBeanMethods = false)
class AuthModuleConfiguration {
}
