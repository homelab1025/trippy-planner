package com.trippyplanner.share;

import org.springframework.context.annotation.Configuration;
import org.springframework.modulith.ApplicationModule;

/**
 * Binds the share module to Spring Modulith. It reaches the routes module only through the
 * root-level {@code RouteQueryService}, never its internal {@code RouteRepository}; it also uses the
 * generated {@code model}/{@code api} OpenAPI contract.
 */
@ApplicationModule(allowedDependencies = {"routes", "model", "api"})
@Configuration(proxyBeanMethods = false)
class ShareModuleConfiguration {
}
