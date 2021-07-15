<?php
class DiskStatus {
    public const RAW_OUTPUT = true;
    /** @var string */
    private $diskPath;

    /**
     * @param string $diskPath
     */
    public function __construct($diskPath) {
        $this->diskPath = $diskPath;
    }

    /**
     * @param bool $rawOutput
     *
     * @return float|string
     */
    public function totalSpace($rawOutput = false) {
        $diskTotalSpace = @disk_total_space($this->diskPath);
        if ($diskTotalSpace === false) {
            throw new Exception('totalSpace(): Invalid disk path.');
        }

        return $rawOutput ? $diskTotalSpace : $this->addUnits($diskTotalSpace);
    }

    /**
     * @param bool $rawOutput
     *
     * @return float|string
     */
    public function freeSpace($rawOutput = false) {
        $diskFreeSpace = @disk_free_space($this->diskPath);
        if ($diskFreeSpace === false) {
            throw new Exception('freeSpace(): Invalid disk path.');
        }

        return $rawOutput ? $diskFreeSpace : $this->addUnits($diskFreeSpace);
    }

    /**
     * @param int $precision
     *
     * @return float
     */
    public function usedSpace($precision = 1) {
        try {
            return round((100 - ($this->freeSpace(self::RAW_OUTPUT) / $this->totalSpace(self::RAW_OUTPUT)) * 100), $precision);
        } catch (Exception $e) {
            throw $e;
        }
    }

    /**
     * @return string
     */
    public function getDiskPath() {
        return $this->diskPath;
    }

    /**
     * @param int|float $bytes
     *
     * @return string
     */
    private function addUnits($bytes) {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        for ($i = 0; $bytes >= 1024 && $i < count($units) - 1; ++$i) {
            $bytes /= 1024;
        }

        return round($bytes, 1).' '.$units[$i];
    }
}
?>

