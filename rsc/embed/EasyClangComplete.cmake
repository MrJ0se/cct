if (NOT ECC)
set (ECC 1)

include ("${CMAKE_CURRENT_LIST_DIR}/vars.cmake")

if("${BOARDPACKAGE}" STREQUAL "AVR")
	include ("${CMAKE_CURRENT_LIST_DIR}/avr/EasyClangComplete.cmake")
endif()

endif()