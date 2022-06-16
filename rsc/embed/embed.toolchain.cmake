if (NOT EMBED_CMAKE)
set (EMBED_CMAKE 1)

include ("${CMAKE_CURRENT_LIST_DIR}/vars.cmake")

if("${BOARDPACKAGE}" STREQUAL "AVR")
	include ("${CMAKE_CURRENT_LIST_DIR}/avr/toolchain.cmake")
endif()

endif()