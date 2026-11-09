package com.trippyplanner;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.base.DescribedPredicate.alwaysTrue;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.onionArchitecture;

/**
 * Enforces onion layering inside every module: {@code domain.model} at the core, then {@code application}
 * (use cases plus the ports they need), then {@code adapter.*} at the edge. Module boundaries themselves are
 * enforced by {@link ModuleArchitectureTest}; the two are orthogonal.
 */
@AnalyzeClasses(packages = "com.trippyplanner", importOptions = ImportOption.DoNotIncludeTests.class)
class OnionArchitectureTest {

    private static final String GENERATED_API = "com.trippyplanner.api..";
    private static final String GENERATED_MODEL = "com.trippyplanner.model..";

    // Optional layers: not every module has every ring (e.g. share is just a web adapter over routes.api)
    @ArchTest
    static final ArchRule modulesFollowOnionArchitecture = onionArchitecture()
        .domainModels("..domain.model..")
        .domainServices("..domain.service..")
        .applicationServices("..application..")
        .adapter("web", "..adapter.web..")
        .adapter("persistence", "..adapter.persistence..")
        .adapter("email", "..adapter.email..")
        .withOptionalLayers(true)
        // e2e/local scaffolding plugs into auth's EmailService port; it is exempt here as in ModuleArchitectureTest
        .ignoreDependency(resideInAPackage("com.trippyplanner.testsupport.."), alwaysTrue());

    // Onion only constrains dependencies between its own rings; this keeps frameworks out of the core too
    @ArchTest
    static final ArchRule domainDependsOnlyOnJdk = classes()
        .that().resideInAPackage("..domain..")
        .should().onlyDependOnClassesThat().resideInAnyPackage("java..", "..domain..");

    @ArchTest
    static final ArchRule applicationIsTransportAndStorageAgnostic = noClasses()
        .that().resideInAPackage("..application..")
        .should().dependOnClassesThat().resideInAnyPackage(
            GENERATED_API, GENERATED_MODEL,
            "org.springframework.web..", "org.springframework.http..", "org.springframework.jdbc..",
            "jakarta.servlet..")
        .because("HTTP and SQL details belong in adapters; use cases speak domain types");

    @ArchTest
    static final ArchRule generatedContractIsUsedOnlyByWebAdapters = noClasses()
        .that().resideOutsideOfPackages("..adapter.web..", GENERATED_API, GENERATED_MODEL, "com.trippyplanner.testsupport..")
        .should().dependOnClassesThat().resideInAnyPackage(GENERATED_API, GENERATED_MODEL)
        .because("the OpenAPI DTOs are the web adapter's wire format, not the domain model");
}
