<?php
class DiskStatus {
	 const RAW_OUTPUT = true;
	private $diskPath;
function __construct($diskPath) {
	$this->diskPath = $diskPath;
}

public function totalSpace($rawOutput = false) {
$diskTotalSpace = @disk_total_space($this->diskPath);
	if ($diskTotalSpace === FALSE) {
		throw new Exception('totalSpace(): Invalid disk path.');
	}
	return $rawOutput ? $diskTotalSpace : $this->addUnits($diskTotalSpace);
}
public function freeSpace($rawOutput = false) {
	$diskFreeSpace = @disk_free_space($this->diskPath);
	if ($diskFreeSpace === FALSE) {
		throw new Exception('freeSpace(): Invalid disk path.');
	}
	return $rawOutput ? $diskFreeSpace : $this->addUnits($diskFreeSpace);
}
public function usedSpace($precision = 1) {
	try {
		return round((100 - ($this->freeSpace(self::RAW_OUTPUT) / $this->totalSpace(self::RAW_OUTPUT)) * 100), $precision);
	} catch (Exception $e) {
		throw $e;
	}
}
public function getDiskPath() {
	return $this->diskPath;
}
private function addUnits($bytes) {
	$units = array( 'B', 'KB', 'MB', 'GB', 'TB' );
	for($i = 0; $bytes >= 1024 && $i < count($units) - 1; $i++ ) {
		$bytes /= 1024;
	}
		return round($bytes, 1).' '.$units[$i];
	}
}
?>

