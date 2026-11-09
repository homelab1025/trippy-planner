package com.trippyplanner.testsupport;

import org.springframework.context.annotation.Configuration;
import org.springframework.modulith.ApplicationModule;

/**
 * Binds the testsupport module (e2e/local scaffolding) to Spring Modulith. It may reach the
 * auth module only, because it implements auth's {@code EmailService} SPI. No production
 * module depends on it.
 */
@ApplicationModule(allowedDependencies = "auth")
@Configuration(proxyBeanMethods = false)
class TestSupportModuleConfiguration {
}
