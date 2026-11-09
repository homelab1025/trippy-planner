package com.trippyplanner.common;

import org.springframework.context.annotation.Configuration;
import org.springframework.modulith.ApplicationModule;

/**
 * Binds the common module to Spring Modulith. It is a leaf: it depends on no other module
 * and exposes {@code TokenGenerator} for the modules that need it.
 */
@ApplicationModule(allowedDependencies = {})
@Configuration(proxyBeanMethods = false)
class CommonModuleConfiguration {
}
