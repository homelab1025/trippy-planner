# Java Coding Constraints (Based on Effective Java)

You must strictly adhere to the programming idioms and architectural patterns from Joshua Bloch's "Effective Java". Avoid generic, highly verbose, or modern but fragile alternative patterns unless explicitly overridden.

## 1. Creating and Destroying Objects
- Prefer static factory methods over public constructors where it improves readability or enables instance caching (Item 1).
- Use the Builder pattern when faced with constructors requiring more than 4 parameters, especially if many are optional (Item 2).
- Enforce singletons via a single-element `enum` type rather than readResolve/private constructors (Item 3).
- Enforce non-instantiability of utility classes using a private constructor that throws an `AssertionError` (Item 4).
- Use dependency injection to pass resources to dependent classes; never hardcode resources or use rigid singletons for them (Item 5).

## 2. Common Methods
- Always override `hashCode` when you override `equals` (Item 11).
- Always use the `@Override` annotation on every method declaration that overrides a superclass or interface method (Item 40).

## 3. Classes and Interfaces
- Minimize the accessibility of classes and members. Make everything `private` unless it absolutely must be exposed (Item 15).
- Minimize mutability. Design classes to be immutable (`final` classes, `final` fields) unless there is a proven performance or functional need to make them mutable (Item 17).
- Prefer composition over inheritance. Do not extend concrete classes unless they were explicitly designed and documented for inheritance (Item 18).
- Prefer interfaces to abstract classes when defining types that allow multiple implementations (Item 20).

## 4. Generics & Enums
- Do not use raw types (e.g., use `List<String>`, never raw `List`) (Item 26).
- Use `@SuppressWarnings("unchecked")` only on the narrowest possible scope and always add a comment explaining why it is typesafe (Item 27).
- Use enums instead of `int` or `String` constants (Item 34). Use `EnumSet` or `EnumMap` instead of bit fields or ordinal indexing (Item 36, 37).

## 5. Methods & Lambdas
- Validate public/protected method parameters at the beginning of the method. Throw explicit exceptions (`NullPointerException`, `IllegalArgumentException`) (Item 49).
- Return empty collections or arrays instead of returning `null` (Item 54).
- Use `Optional<T>` only as a return type for methods that might not return a value. Never use `Optional` as a field, parameter, or collection element (Item 55).

## 6. General Programming & Exceptions
- Prefer primitive types to boxed primitives (`int` over `Integer`) to avoid accidental `NullPointerException` risks and performance penalties from auto-unboxing loops (Item 61).
- Avoid using strings where other types (enums, custom objects) are more appropriate (Item 62).
- Use exceptions only for exceptional conditions. Do not use them for normal control flow (Item 69).
- Prefer standard, built-in Java exceptions over creating unnecessary custom exception classes (Item 72).