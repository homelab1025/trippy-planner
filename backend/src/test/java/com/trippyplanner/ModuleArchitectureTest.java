package com.trippyplanner;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideOutsideOfPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

/**
 * Enforces the backend module layout: each top-level package under com.trippyplanner is a module, and a
 * module's {@code api} sub-package is the only part other modules may depend on. The generated OpenAPI
 * packages ({@code com.trippyplanner.api}, {@code com.trippyplanner.model}) are a shared contract and are
 * deliberately not modelled as modules.
 */
@AnalyzeClasses(packages = "com.trippyplanner", importOptions = ImportOption.DoNotIncludeTests.class)
class ModuleArchitectureTest {

    private static final String ROOT = "com.trippyplanner";
    private static final String TEST_SUPPORT = ROOT + ".testsupport..";

    @ArchTest
    static final ArchRule modulesDependOnlyOnPermittedModules = layeredArchitecture()
        .consideringOnlyDependenciesInLayers()
        .layer("Auth").definedBy(ROOT + ".auth..")
        .layer("Routes").definedBy(ROOT + ".routes..")
        .layer("Share").definedBy(ROOT + ".share..")
        .layer("Version").definedBy(ROOT + ".version..")
        .layer("Common").definedBy(ROOT + ".common..")
        .layer("TestSupport").definedBy(TEST_SUPPORT)
        .whereLayer("Auth").mayOnlyAccessLayers("Common")
        .whereLayer("Routes").mayOnlyAccessLayers("Auth", "Common")
        .whereLayer("Share").mayOnlyAccessLayers("Routes")
        .whereLayer("Version").mayNotAccessAnyLayer()
        .whereLayer("Common").mayNotAccessAnyLayer()
        // e2e/local scaffolding plugs into auth's EmailService SPI; production code must never reach it
        .whereLayer("TestSupport").mayOnlyAccessLayers("Auth")
        .whereLayer("TestSupport").mayNotBeAccessedByAnyLayer();

    @ArchTest
    static final ArchRule authInternalsAreHidden = internalsOnlyReachableThroughApi("auth");

    @ArchTest
    static final ArchRule routesInternalsAreHidden = internalsOnlyReachableThroughApi("routes");

    @ArchTest
    static final ArchRule authApiDoesNotLeakInternals = apiDoesNotDependOnInternals("auth");

    @ArchTest
    static final ArchRule routesApiDoesNotLeakInternals = apiDoesNotDependOnInternals("routes");

    // Safety net for packages added later but not yet listed as layers above. The generated contract
    // references auth.api.CurrentUser via x-spring-provide-args while AuthController implements AuthApi;
    // that loop is inherent to generating from the contract, so only that edge is ignored.
    @ArchTest
    static final ArchRule topLevelPackagesAreFreeOfCycles = slices()
        .matching(ROOT + ".(*)..")
        .should().beFreeOfCycles()
        .ignoreDependency(resideInAPackage(ROOT + ".api"), resideInAPackage(ROOT + ".auth.api"));

    private static ArchRule internalsOnlyReachableThroughApi(String module) {
        String modulePackage = ROOT + "." + module + "..";
        String apiPackage = ROOT + "." + module + ".api..";
        return noClasses()
            .that().resideOutsideOfPackages(modulePackage, TEST_SUPPORT)
            .should().dependOnClassesThat(resideInAPackage(modulePackage).and(resideOutsideOfPackage(apiPackage)))
            .because(module + ".api is the only part of the " + module + " module other modules may use");
    }

    private static ArchRule apiDoesNotDependOnInternals(String module) {
        String modulePackage = ROOT + "." + module + "..";
        String apiPackage = ROOT + "." + module + ".api..";
        return noClasses()
            .that().resideInAPackage(apiPackage)
            .should().dependOnClassesThat(resideInAPackage(modulePackage).and(resideOutsideOfPackage(apiPackage)))
            .because("a published API that exposes internal types would let callers bypass the boundary");
    }
}
