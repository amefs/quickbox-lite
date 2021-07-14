<?php

$rules = [
    /**
     * Rule sets
     */
    '@Symfony' => true,
    '@PHP74Migration' => true,
    /**
     * Rules
     */
    // Alias
    // Array Notation
    // Basic
    'braces' => [
        'allow_single_line_closure' => true,
        'position_after_functions_and_oop_constructs' => 'same',
    ],
    // Casing
    // Cast Notation
    // Class Notation
    // Class Usage
    // Comment
    // Constant Notation
    // Control Structure
    'include' => false,
    'yoda_style' => [
        'equal' => false,
        'identical' => false,
    ],
    // Doctrine Annotation
    // Function Notation
    // Import
    // Language Construct
    // List Notation
    // Namespace Notation
    // Naming
    // Operator
    'binary_operator_spaces' => [
        'operators' => [
            '=>' => 'align_single_space_minimal',
            '=' => 'align_single_space_minimal',
        ]
    ],
    'ternary_to_null_coalescing' => true,
    // PHP Tag
    // PHPUnit
    // PHPDoc
    // Return Notation
    // Semicolon
    // Strict
    // String Notation
    'explicit_string_variable' => true,
    'simple_to_complex_string_variable' => true,
    'single_quote' => false,
    // Whitespace
    'array_indentation' => true,
];

$excludes = [
    'vendor',
    'storage',
    'node_modules',
];

$finder = PhpCsFixer\Finder::create()
    ->exclude($excludes)
    ->in(join_paths(__DIR__, 'setup', 'dashboard'))
;

$config = new PhpCsFixer\Config();
return $config
    ->setRiskyAllowed(false)
    ->setRules($rules)
    ->setFinder($finder)
;

// util functions
function join_paths() {
    $paths = array();

    foreach (func_get_args() as $arg) {
        if ($arg !== '') { $paths[] = $arg; }
    }
    return preg_replace('#/+#','/',join('/', $paths));
}
