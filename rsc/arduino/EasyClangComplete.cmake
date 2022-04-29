include ("${CMAKE_CURRENT_LIST_DIR}/arduino.vars.cmake")

if(NOT CCT_TARGET)
	add_definitions(-DUSBCON -DUBRR1H -DUBRR2H -UBRR3H)
	include_directories(
	#AVR chip basic
		"${ARDIDE}/hardware/tools/avr/avr/include"
	)

	set(ARD_IVARIANT "${ARDIDE}/hardware/arduino/avr/variants/${ARD_variant}")
	set(ARD_ICORE "${ARDIDE}/hardware/arduino/avr/cores/arduino")
	add_library(arduinocore INTERFACE)
	target_include_directories(arduinocore INTERFACE ${ARD_IVARIANT} ${ARD_ICORE})

	macro(USE_ARDU_LIB proj library)
		set(ext_lib_inc "${ARDIDE}/hardware/arduino/avr/libraries/${library}/src")
		target_include_directories(${proj} PUBLIC ${ext_lib_inc})
	endmacro()
endif()