<?php
// SPDX-License-Identifier: GPL-3.0-or-later

$rules = [
    /**
     * Rule sets
     */
    '@Symfony' => true,
    '@Symfony:risky' => true,
    '@PHP74Migration' => true,
    /**
     * Rules
     */
    // Alias
    'no_alias_functions' => true,
    'pow_to_exponentiation' => true,
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
    'no_homoglyph_names' => true,
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
    'strict_param' => true,
    'strict_comparison' => true,
    // String Notation
    'explicit_string_variable' => true,
    'simple_to_complex_string_variable' => true,
    'no_trailing_whitespace_in_string' => false,
    'single_quote' => true,
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
    ->setRiskyAllowed(true)
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
