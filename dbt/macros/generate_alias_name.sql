{% macro generate_alias_name(custom_alias_name, node) -%}
    {%- if custom_alias_name is not none -%}
        {{ custom_alias_name | trim }}
    {%- elif node.resource_type == 'seed' and node.name[:2] == 'lc' and '_' in node.name -%}
        {#- Strip lcNNNN_ prefix from leetcode seeds for clean PG table names -#}
        {%- set parts = node.name.split('_', 1) -%}
        {{ parts[1] }}
    {%- else -%}
        {{ node.name }}
    {%- endif -%}
{%- endmacro %}
