//SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@semaphore-protocol/contracts/Semaphore.sol";
import "@semaphore-protocol/contracts/base/SemaphoreVerifier.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphoreVerifier.sol";

contract SemaphoreDeployer {
    // Deployed contract addresses
    address public immutable semaphoreAddress;
    address public immutable verifierAddress;
    address public immutable deployer;

    event SemaphoreDeployed(
        address indexed semaphore,
        address indexed verifier,
        address indexed deployer
    );

    /**
     * @dev Constructor deploys Semaphore and Verifier automatically
     */
    constructor() {
        // Store deployer address (msg.sender becomes the admin)
        deployer = msg.sender;

        // Deploy the verifier first
        SemaphoreVerifier verifier = new SemaphoreVerifier();
        verifierAddress = address(verifier);

        // Deploy Semaphore with the verifier
        Semaphore semaphore = new Semaphore(
            ISemaphoreVerifier(verifierAddress)
        );
        semaphoreAddress = address(semaphore);

        emit SemaphoreDeployed(semaphoreAddress, verifierAddress, msg.sender);
    }

    /**
     * @dev Get deployed contract instances
     * @return semaphore The deployed Semaphore contract instance
     * @return verifier The deployed SemaphoreVerifier contract instance
     */
    function getContracts()
        external
        view
        returns (Semaphore semaphore, SemaphoreVerifier verifier)
    {
        semaphore = Semaphore(semaphoreAddress);
        verifier = SemaphoreVerifier(verifierAddress);

        return (semaphore, verifier);
    }

    /**
     * @dev Check if caller is the original deployer
     * @return isDeployer True if msg.sender is the deployer
     */
    function isDeployer(address account) external view returns (bool) {
        return account == deployer;
    }
}
