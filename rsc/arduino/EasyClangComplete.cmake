include ("${CMAKE_CURRENT_LIST_DIR}/arduino.vars.cmake")

if(NOT CCT_TARGET)
	include_directories(
	#AVR chip basic
		"${ARDIDE}/hardware/tools/avr/avr/include"
	#arduino SDK
		"${ARDIDE}/hardware/arduino/avr/cores/arduino"
	)
	if (ARD_variant)
		include_directories("${ARDIDE}/hardware/arduino/avr/variants/${ARD_variant}")
	endif()
endif()
if(NOT "${CCT_TARGET_PLATFORM}" EQUAL "arduino")
	macro(USE_ARDU_LIB proj x)
		target_include_directories(${proj} "${ARDIDE}/hardware/arduino/avr/libraries/${x}/src")
	endmacro()
endif()